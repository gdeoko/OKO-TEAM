# BUILD NOTES — как собрать ролик в СВЕЖЕМ контейнере (грабли v14, обязательно)

Рабочая обвязка сборки (stage1/2/3) НЕ хранилась в git у прошлых сессий — жила во временной
папке. Теперь эталонный оркестратор закоммичен: `pipeline/n14/build_all.py` (stage1 + gl + fx +
3D) и `pipeline/n14/finalize.py` (stage2 композит + stage3 караоке/аудио). Копировать под новый
ролик (сменить DAY, сценарий, кадры, набор fx/переходов по реестрам) — механика та же.

## Порядок (проверено на n14)
1. Окружение: `pip3 install -q edge-tts rembg onnxruntime pillow numpy certifi fonttools`;
   `cat /root/.ccr/ca-bundle.crt >> $(python3 -m certifi)`.
2. **npm — ТОЛЬКО в изолированной папке скилла** (иначе уходит в node_modules корня репо, где
   package.json сайта): `cd .claude/skills/reels-machine && echo '{"name":"rm","private":true}' >
   package.json && npm i playwright three gl-transitions lottie-web`.
   Chromium уже есть: `/opt/pw-browsers/chromium` (симлинк на бинарь). НЕ `playwright install`.
   Для gl: `export RM_NODE_MODULES="$PWD/node_modules" RM_CHROMIUM=/opt/pw-browsers/chromium`.
3. **Секреты — из `secrets.env.b64`, НЕ из `secrets.env`** (плоский файл бывает устаревший/пустой):
   `source <(base64 -d /home/user/OKO-TEAM/secrets.env.b64)`. Так же и в боте (VCODE_MEDIA_BOT_TOKEN).
4. Озвучка: `edge-tts ru-RU-DmitryNeural +6%`. **WordBoundary через прокси приходит ПУСТЫМ** —
   тайминги слов считать пропорционально длине слова по длительности mp3 (см. n14/tts.py). Ударения
   U+0301 в тексте оставлять для произношения (аудио с ними работает), из слов для караоке — убирать.
5. Кадры: Pexels portrait, дедуп по id через USED_FOOTAGE. Клипы бывают с мелким вотермарком —
   визуально отбраковывать (в n14 id 35313959 проскочил с «pexels»).
6. FX-движок `motion/fx_engine.js` читает **`fx_page.html` и `fonts/` из CWD** — перед запуском
   `cp motion/fx_page.html fx_page.html` и создать `fonts/` с именами, которые он ждёт:
   `MontserratBlack.ttf` (=montserrat-900), `golos-text-v7-cyrillic_latin-900.ttf` (=montserrat-900),
   `manrope-v20-cyrillic_latin-800.ttf`. Плюс `soyuz.ttf` для караоке.
   Акцент в fx уже бренд-оранж (`LIME='#EA5920'` в fx_page.html) — зелёного нет.
   Реальные поля методов (o.*): statcard(val,y,label,suf), lowerthird(title,sub,y), steps(items=[[num,label]],y),
   gridpop(y), callout(x,y,dir,label) — но `dir` конфликтует с ключом каталога job.dir, НЕ передавать,
   profilecmp(cards=[[label,num,color]]), slam(words,colors,y), stamp(text,color,x,y,big,rot), dm(items,y),
   likes(n), toast(text), ticker(text), donut(val,x,y,label), bars(data), camui(tc).
7. 3D `three/three_render.js` поднимает http.server из **`three3d/` относительно CWD** — симлинк:
   `ln -sfn three/three3d three3d`. Фигуры scene.html: coin/torus/diamond/droplet/ring.
8. gl-переходы: имена регистрозависимы, брать из `node -e "require('gl-transitions')..."` (валидные:
   windowslice, Swirl, doorway, Fold, hexagonalize, Mosaic, … — 125 шт). Неверное имя → assert падает.
9. Обложка: `motion/cover_flux.py "<prompt>" "<ЗАГОЛОВОК>" cover.jpg ../logo_hd.png`. FLUX ZeroGPU
   квота часто исчерпана → авто-фолбэк Pexels-стилл + лого + заголовок (работает, качество ок).
10. **Караоке ASS — КРИТИЧНО:** строка `Format:` в `[Events]` ОБЯЗАНА содержать поле `Name`
    (`Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`). Если `Name` пропущен,
    а в `Dialogue` пустой Name (`Sub,,0,0,...`), поля сдвигаются и в НАЧАЛО текста утекает лишняя
    запятая → на экране «,слово». Это была главная бага v14. Шрифт: `Soyuz Grotesk` (=soyuz.ttf,
    fc-scan подтверждает семейство), строчные — это норм (бренд). Стандартное `\k`-караоке: одно
    событие на строку, Primary=оранж &H2059EA&, Secondary=белое.
11. Аудио: музыка `aloop`+`atrim=0:total`+fade-in 1.4/fade-out 2.6; в конце цепочки добавить
    `apad,atrim=0:total`, чтобы аудио не кончалось раньше видео (иначе тишина в эндкарде).
    SFX разные по смыслу (impact на цифрах, ding на CTA, whoosh на переходах) через sfx_bank.py.
12. Доставка: ролик 45с ≈ 42-44 МБ — под лимит бота (50 МБ). В бот **файлом** (sendDocument) с
    `thumbnail=@thumb.jpg` (из обложки, scale=320). В чат SendUserFile лимит 30 МБ — слать сжатое
    превью (scale=720:1280, crf 28), полный файл только в бот.
