# AUTOBUILD — авто-сборка ролика DIESEL и постановка в очередь VPS

Этот ранбук выполняет СВЕЖАЯ автосессия (по расписанию). Цель: собрать ОДИН
новый рекламный ролик DIESEL CARGO (спецтехника из Китая под ключ) проверенным
пайплайном и положить его в очередь VPS — дальше VPS-крон сам публикует его в
YouTube + TikTok + Instagram (10:00 / 15:00 / 20:00 МСК).

Ключи (YT/TikTok/VPS) уже в окружении (SessionStart-хук грузит `secrets.env`).
Проверить: `echo $OKO_VPS_CTRL_URL` и `echo ${YT_REFRESH_TOKEN:0:6}` — не пусто.

## 0. Клиент и правила
- Бренд: DIESEL CARGO, dieselcompany.pro, ниша — импорт строительной/спецтехники из Китая под ключ.
- Палитра: чёрный + амбер #EA5920. Шрифты: Montserrat/Manrope/Soyuz. Голос: edge-tts `ru-RU-DmitryNeural` (PLAIN текст, без ударений).
- НЕ выдумывать цены. Формальное «вы». CTA — «напишите город и задачу в комментариях».
- РАЗНООБРАЗИЕ: каждый ролик — НОВАЯ тема/угол, НОВЫЕ кадры (другие video id), новые данные инфографики.
  Не повторять тему/кадры прошлых роликов. Смотреть `factory/USED.md` (дописывать туда id/темы).

## 1. Рабочая копия пайплайна
```
ROOT=/home/user/OKO-TEAM/oko-app/factory
W=$SCRATCH/reel_$(date +%s); mkdir -p $W/{vo,foot,ig/html,segs,cover_cand}
cp $ROOT/pipeline/*.py $ROOT/pipeline/capture.js $W/
cp -r $ROOT/pipeline/html/* $W/ig/html/ ; cp -r $ROOT/pipeline/sfx $W/sfx
cp $ROOT/pipeline/endcard.mp4 $W/endcard.mp4
```
В скриптах `plan.py/build_*.py` путь к шрифтам `FB`/`F` = `$ROOT/fonts` (поправить абсолютным путём),
лого = `$ROOT/logo_hd.png`. `make_cover.py`: W → твой $W.

## 2. Сценарий (6 сегментов) — НОВАЯ тема
Написать `$W/vo/script_src.json` (ключи s1..s6): хук → возможности → надёжность →
импорт под ключ → что входит в цену → CTA. Примеры тем (взять НЕиспользованную):
мини-экскаватор; фронтальные погрузчики/флот; гарантия+сервис+запчасти; сравнение аренда/покупка;
самосвалы; дорожные катки; автокраны; вилочные погрузчики; бульдозеры; экономика владения.

## 3. Озвучка → план → графика → сборка (проверенная цепочка)
```
# VO
python3 - <<'PY'
import asyncio,edge_tts,json
W="'$W'";S=json.load(open(W+"/vo/script_src.json"))
async def m():
  for s in ["s1","s2","s3","s4","s5","s6"]:
    await edge_tts.Communicate(S[s],"ru-RU-DmitryNeural",rate="+6%").save(f"{W}/vo/{s}.mp3")
asyncio.run(m())
PY
python3 $W/plan.py            # timing.json / subs.ass / words.json
```
- Кадры: скачать 12 УНИКАЛЬНЫХ вертикальных клипов под сценарий (Pexels/Pixabay, ключи в env)
  в `$W/foot/b01..b12.mp4`. Проверить, что кадры СООТВЕТСТВУЮТ озвучке (не форсить).
- `build_accents.py`: массив `A` (12 инфографик, типы chips/ticks/ring/route/bar/stamp/badge, без 2 одинаковых подряд, x=l/c/r) под текущую тему; ВРЕМЕНА выставить по 2 на сегмент из `timing.json` seg_start/segdurs.
- `build_titles.py`: 2 заголовка на хук (s1) + 1 на CTA (s6).
- `make_cover.py`: обложка — hero-кадр темы + бренд-текст (без выдуманной цены).
- Собрать:
```
python3 $W/build_accents.py; python3 $W/build_titles.py; python3 $W/build_subs.py
python3 $W/make_cover.py
python3 $W/assemble.py &        # base.mp4
python3 $W/audio.py &           # audio.m4a
# overlays -> qtrle .mov (N = words.json total * 30)
N=$(python3 -c "import json;print(int(round(json.load(open('$W/words.json'))['total']*30)))")
for n in accents titles subs; do
  rm -rf $W/ig/frames/$n; mkdir -p $W/ig/frames/$n
  node $W/capture.js "$W/ig/html/$n.html" $N $W/ig/frames/$n
  ffmpeg -y -framerate 30 -i $W/ig/frames/$n/f%03d.png -c:v qtrle -pix_fmt argb $W/ig/$n.mov -loglevel error
done
wait
python3 $W/compose.py           # -> $W/reel.mp4 (1080x1920)
```
- QC: вытащить 12 кадров сеткой, проверить: обложка ровная, субтитры 2 слова без обводки,
  инфографика в каждом кадре и не перекрывает лицо, эндкард ровный, 9:16.

## 4. Описание (ОБЯЗАТЕЛЬНО по ТЗ)
Собрать `meta.json`: `{title, yt_desc, caption}`. И yt_desc, и caption содержат:
краткое содержание + польза + воронка (напишите город и задачу) + **15–30 ключевых фраз**
для поиска ВНИЗУ (без хештегов, через запятую). dieselcompany.pro в тексте.

## 5. Положить в очередь VPS (крон опубликует сам)
Найти следующий свободный номер очереди и залить ролик кусками + meta.json:
```
python3 - <<'PY'
import os,base64,glob,subprocess,requests,hashlib,json
URL=os.environ['OKO_VPS_CTRL_URL'];TOK=os.environ['OKO_VPS_CTRL_TOKEN']
H={"Authorization":f"Bearer {TOK}","Content-Type":"application/json"}
W="'$W'"
# next queue id
r=requests.post(URL+"/exec",headers=H,json={"cmd":"ls /opt/oko-poster/queue 2>/dev/null; echo ---; ls /opt/oko-poster/published 2>/dev/null"},timeout=30)
used=set(x for x in r.json()['stdout'].split() if x.isdigit())
nn=next(f"{i:03d}" for i in range(1,999) if f"{i:03d}" not in used)
requests.post(URL+"/exec",headers=H,json={"cmd":f"rm -rf /opt/oko-poster/queue/{nn} && mkdir -p /opt/oko-poster/queue/{nn}/parts"},timeout=30)
subprocess.run(["split","-b","1500000","-d","-a","3",W+"/reel.mp4",W+"/part_"])
parts=sorted(glob.glob(W+"/part_*"))
for f in parts:
  requests.post(URL+"/deploy",headers=H,json={"path":f"queue/{nn}/parts/"+os.path.basename(f),"content_b64":base64.b64encode(open(f,'rb').read()).decode()},timeout=120)
requests.post(URL+"/deploy",headers=H,json={"path":f"queue/{nn}/meta.json","content_b64":base64.b64encode(open(W+"/meta.json",'rb').read()).decode()},timeout=30)
loc=hashlib.md5(open(W+"/reel.mp4",'rb').read()).hexdigest()
rr=requests.post(URL+"/exec",headers=H,json={"cmd":f"cd /opt/oko-poster/queue/{nn} && cat parts/part_* > reel.mp4 && rm -rf parts && md5sum reel.mp4"},timeout=60)
print("QUEUED",nn,"| vps",rr.json()['stdout'].strip(),"| local",loc,"| MATCH",loc in rr.json()['stdout'])
PY
```
Если md5 совпал — ролик в очереди, крон опубликует его в ближайший слот (10/15/20 МСК).
НЕ публиковать вручную (крон сам). Дописать тему/id кадров в `factory/USED.md`.

## Проверка постинга (для отладки)
`publish_next.py` на VPS — retry-safe, дублей не делает (YT/TikTok/IG отмечаются done).
Лог: `/opt/oko-poster/logs/factory.log` и `logs/cron.log`.
