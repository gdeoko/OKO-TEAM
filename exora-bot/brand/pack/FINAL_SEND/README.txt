EXORA — финальный бренд-пак для Telegram (v3)
================================================
FIX v3: рассеянное ровное свечение (без квадратной обрезки).
Glow теперь рисуется на полном холсте, а не на bbox лого —
Gaussian blur растекается свободно во все стороны.
================================================

Что внутри и куда что ставить.

── 1) АВАТАР (для @exorappbot и канала) ──────────────────────────
   exora-AVATAR-1024.png   1024×1024   — универсальный, качество
   exora-AVATAR-640.png     640×640    — минимум по спеке Telegram

   Установка (через BotFather):
      → /mybots → выбрать @exorappbot → Edit Bot → Edit Botpic
      → отправить exora-AVATAR-1024.png (или 640 если BotFather ругается)
   Установка на канал:
      → Настройки канала → «Изменить фото» → загрузить AVATAR-1024

── 2) ГОРИЗОНТАЛЬНАЯ ОБЛОЖКА (с текстом «EXORA») ─────────────────
   exora-COVER-1920x1080.png  — Full-HD, для сайта / соцсетей / OG
   exora-COVER-1280x720.png   — HD 16:9, для канала / YouTube / OG-preview
   exora-COVER-640x360.png    — маленькая, для описания бота в /start

── 3) SVG 1:1 для стартового экрана Mini App ─────────────────────
   exora-ICON-square-512.svg   — цветной, 512×512, для Mini App splash
   exora-ICON-mono-512.svg     — монохром fill=currentColor (строгий стандарт TG)
   exora-ICON-square-2048.png  — 2K PNG-версия того же самого
   exora-ICON-512.png          — PNG 512×512
   exora-ICON-192.png          — PNG 192×192 (PWA favicon)

   Установка на Mini App:
      → BotFather → /newapp или /myapps → выбрать бот → Edit Web App
      → загрузить exora-ICON-square-512.svg
   Установка в манифест PWA:
      { "src":"/exora-192.png","sizes":"192x192","type":"image/png" }

── ЛОГО ─────────────────────────────────────────────────────────
Настоящее (Aurora Liquid) лежит без изменений — использовано во всех композитах.
Оригинал: exora-FINAL-master.png (2048×2048)
Прозрачный вырез: exora-FINAL-transparent.png (2048×2048 RGBA, alpha из isnet)

── ЦВЕТА (для сайта / рекламы) ──────────────────────────────────
   Фон:      #04070E → #0A0F1A   (глубокий тёмный градиент)
   Основной: #6CE1AC              (мятный металлик)
   Свет:     #DCFFEE              (top highlight)
   Тень:     #2E9B6C              (bottom shadow)
   Текст:    #F5F7FA / #B7C5C0    (заголовок / подпись)

── ШРИФТЫ ───────────────────────────────────────────────────────
   Wordmark:  Orbitron 900 (character-tracking +18)
   UI/tag:    Space Grotesk 500-800
   Оба — бесплатные, Google Fonts.

Сделано на настоящем лого Aurora Liquid без пересоздания.
