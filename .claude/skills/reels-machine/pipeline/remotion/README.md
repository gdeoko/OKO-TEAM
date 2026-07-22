# reels-machine · Remotion (движок премиум-монтажа)

Программный монтаж вертикальных роликов (1080×1920) на бренде OKO — стоки + караоке-
субтитры + заголовки + переходы + лого. Бесплатно, безлимитно, локальный рендер.

## Установка (один раз)
    npm install                       # REMOTION_SKIP_BROWSER_DOWNLOAD=1
## Ассеты
    public/stock1.mp4, stock2.mp4     # стоки (Pexels), качать под сценарий (в .gitignore)
    public/fonts/*.ttf                # бренд-шрифты (офлайн)
    public/logo.png                   # лого OKO
## Рендер (через системный chromium, БЕЗ докачки)
    SHELL=/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell
    npx remotion render src/index.ts OkoReel out.mp4 --browser-executable=$SHELL --concurrency=4

## Грабли (проверено 22.07)
- headless_shell (не полный chrome) — иначе "Old Headless mode removed".
- OffthreadVideo (не Video) — chromium не декодит H.264 сам.
- Шрифты — ТОЛЬКО офлайн (FontFace+staticFile): прокси-CA рушит fonts.gstatic.
- Статичный Montserrat (не variable) — variable подвешивал delayRender.
