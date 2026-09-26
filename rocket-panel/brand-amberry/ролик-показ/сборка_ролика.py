#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ролик «реальный показ бота AMBERRY» — на автомате, без Telegram.

Экран бота рисуется из его же настоящих текстов и кнопок (они в коде
бота), а не снимается вручную. Результат генерации кладётся настоящей
картинкой и сразу уходит под муть — то самое правило владельца: видно,
что бот отработал, не видно, что именно.

Один вызов -> один ролик. Персонаж, входное фото и результат -
аргументы, поэтому тем же скриптом гоним любую из пяти девушек и любой
формат.

    python3 сборка_ролика.py <лицо> <входное.jpg> <результат.jpg> [выход.mp4]

Ничего не логинит: Telegram не нужен вовсе. Пишет HTML-анимацию и
снимает её Chromium'ом (Playwright) в вертикальное видео 1080x1920.
"""
import asyncio
import base64
import os
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
ФОНТЫ = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
АВАТАР = os.path.join(БРЕНД, "amberry-avatar-256.png")
ЛОГО = os.path.join(БРЕНД, "amberry-icon-512-alpha.png")


def b64(путь, mime):
    with open(путь, "rb") as ф:
        return "data:%s;base64,%s" % (mime, base64.b64encode(ф.read()).decode())


def шрифт(путь):
    with open(путь, "rb") as ф:
        return base64.b64encode(ф.read()).decode()


def html(лицо, входное, результат):
    m900 = шрифт(os.path.join(ФОНТЫ, "montserrat-v31-cyrillic_latin-900.ttf"))
    m700 = шрифт(os.path.join(ФОНТЫ, "montserrat-v31-cyrillic_latin-700.ttf"))
    m500 = шрифт(os.path.join(ФОНТЫ, "montserrat-v31-cyrillic_latin-500.ttf")) \
        if os.path.exists(os.path.join(ФОНТЫ, "montserrat-v31-cyrillic_latin-500.ttf")) else m700
    авт = b64(АВАТАР, "image/png")
    лого = b64(ЛОГО, "image/png")
    вх = b64(входное, "image/jpeg")
    рез = b64(результат, "image/jpeg")
    return ШАБЛОН.replace("__M900__", m900).replace("__M700__", m700) \
        .replace("__M500__", m500).replace("__АВАТАР__", авт) \
        .replace("__ЛОГО__", лого).replace("__ВХОД__", вх).replace("__РЕЗ__", рез)


ШАБЛОН = r"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
@font-face{font-family:M9;src:url(data:font/ttf;base64,__M900__)}
@font-face{font-family:M7;src:url(data:font/ttf;base64,__M700__)}
@font-face{font-family:M5;src:url(data:font/ttf;base64,__M500__)}
*{margin:0;padding:0;box-sizing:border-box}
:root{--pink:#FF0A8C;--vio:#7A2BFF;--bg:#0b1016;--bot:#17212b;--usr:#2b1830}
html,body{width:1080px;height:1920px;overflow:hidden;background:#000;font-family:M5,Arial,sans-serif}
#tg{position:absolute;inset:0;background:
  radial-gradient(120% 60% at 50% 0%,#141d27 0%,var(--bg) 60%);display:flex;flex-direction:column}
/* шапка */
#hdr{height:132px;background:#17212b;display:flex;align-items:center;padding:0 34px;gap:24px;
  box-shadow:0 1px 0 #0006;z-index:5}
#hdr .back{color:#6ab3f3;font-size:52px;font-family:M7}
#hdr img{width:84px;height:84px;border-radius:50%;object-fit:cover}
#hdr .nm{font-family:M7;color:#fff;font-size:40px;line-height:1.1}
#hdr .st{color:#7d8b99;font-size:28px;margin-top:4px}
#hdr .st b{color:var(--pink)}
/* лента */
#chat{flex:1;padding:36px 30px 20px;display:flex;flex-direction:column;gap:26px;
  overflow-y:auto;scroll-behavior:smooth}
#chat::-webkit-scrollbar{width:0;height:0;display:none}
.row{display:flex;align-items:flex-end;gap:18px;opacity:0;transform:translateY(30px);
  transition:opacity .45s ease,transform .45s ease}
.row.on{opacity:1;transform:none}
.row.bot .av{width:70px;height:70px;border-radius:50%;flex:0 0 70px;object-fit:cover}
.bub{max-width:760px;padding:26px 30px;border-radius:30px;font-size:37px;line-height:1.4;color:#fff}
.bot .bub{background:var(--bot);border-bottom-left-radius:8px}
.me{margin-left:auto;flex-direction:row-reverse}
.me .bub{background:linear-gradient(135deg,#3a1c4a,#4a1f39);border-bottom-right-radius:8px}
.bub b{font-family:M7}
.hint{color:#8fa0b0;font-size:30px;margin-top:8px}
.slogan{font-family:M7;font-size:40px}
/* инлайн-кнопки */
.kb{display:flex;flex-direction:column;gap:14px;margin-top:22px}
.kbrow{display:flex;gap:14px}
.btn{flex:1;background:#0e1620;border:2px solid #24384a;border-radius:20px;
  padding:24px;text-align:center;color:#dbe7f2;font-family:M7;font-size:34px;
  position:relative;overflow:hidden}
.btn.hot{border-color:var(--pink);color:#fff;box-shadow:0 0 0 0 #ff0a8c88}
.btn.sm{font-size:30px;padding:22px 14px;white-space:nowrap}
.tap{position:absolute;inset:0;background:radial-gradient(circle,#ff0a8c55,transparent 60%);
  opacity:0;transform:scale(.2)}
.tap.go{animation:tap .6s ease}
@keyframes tap{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(2.4)}}
/* фото-сообщение */
.photo{width:520px;height:650px;border-radius:26px;object-fit:cover;display:block}
.me .photo{border-bottom-right-radius:8px}
/* печатает */
.typing{display:flex;gap:12px;padding:34px 34px}
.typing i{width:20px;height:20px;border-radius:50%;background:#6c7c8c;animation:bl 1.2s infinite}
.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}
@keyframes bl{0%,60%,100%{opacity:.3}30%{opacity:1}}
/* генерация */
.gen{display:flex;align-items:center;gap:22px}
.spin{width:54px;height:54px;border-radius:50%;border:6px solid #24384a;border-top-color:var(--pink);
  animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.timer{font-family:M9;font-size:44px;color:var(--pink)}
.prog{height:10px;border-radius:6px;background:#0e1620;margin-top:18px;overflow:hidden}
.prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--pink),var(--vio))}
/* результат + муть */
.reswrap{position:relative;width:600px;height:750px;border-radius:26px;overflow:hidden}
.reswrap img{width:100%;height:100%;object-fit:cover;filter:blur(0);transition:filter 1.1s ease}
.reswrap.hide img{filter:blur(60px) saturate(1.1)}
.px{position:absolute;inset:0;background-size:34px 34px;
  background-image:linear-gradient(#0004 1px,transparent 1px),linear-gradient(90deg,#0004 1px,transparent 1px);
  opacity:0;transition:opacity 1.1s ease}
.reswrap.hide .px{opacity:1}
.frame{position:absolute;inset:14px;border:5px solid var(--pink);border-radius:22px;
  box-shadow:0 0 40px #ff0a8c66,inset 0 0 40px #ff0a8c33;opacity:0;transition:opacity .9s ease}
.reswrap.hide .frame{opacity:1}
.cap{position:absolute;left:0;right:0;bottom:40px;text-align:center;opacity:0;transition:opacity .9s ease}
.reswrap.hide .cap{opacity:1}
.cap .lg{width:120px;height:120px;margin:0 auto 14px;display:block;filter:drop-shadow(0 0 20px #ff0a8c88)}
.cap .t{font-family:M9;font-size:42px;color:#fff;text-shadow:0 0 20px var(--pink)}
.cap .h{font-family:M7;font-size:30px;color:var(--vio);margin-top:8px;
  text-shadow:0 0 14px var(--vio)}
/* аутро */
#outro{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 40%,#1a0f18,#07060a 70%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;opacity:0;
  transition:opacity .8s ease;z-index:20}
#outro.on{opacity:1}
#outro img{width:300px;height:300px;filter:drop-shadow(0 0 50px #ff0a8caa)}
#outro .wm{font-family:M9;font-size:120px;letter-spacing:6px;
  background:linear-gradient(90deg,var(--pink),var(--vio));-webkit-background-clip:text;background-clip:text;color:transparent}
#outro .nk{font-family:M7;font-size:46px;color:#fff}
#outro .cta{font-family:M9;font-size:52px;color:var(--pink);margin-top:10px;text-shadow:0 0 24px var(--pink)}
.inp{height:120px;background:#17212b;display:flex;align-items:center;padding:0 40px;gap:24px}
.inp .f{flex:1;color:#5d6b79;font-size:34px}
.inp .clip,.inp .mic{color:#6c7c8c;font-size:44px;font-family:M7}
</style></head><body>
<div id="tg">
  <div id="hdr">
    <div class="back">‹</div>
    <img src="__АВАТАР__">
    <div><div class="nm">AMBERRY</div><div class="st"><b>бот</b> · онлайн</div></div>
  </div>
  <div id="chat"></div>
  <div class="inp"><div class="clip">📎</div><div class="f">Сообщение…</div><div class="mic">🎙</div></div>
</div>
<div id="outro">
  <img src="__ЛОГО__">
  <div class="wm">AMBERRY</div>
  <div class="nk">@theamberrybot</div>
  <div class="cta">ПЕРВАЯ — БЕСПЛАТНО</div>
</div>
<script>
const chat=document.getElementById('chat');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function scroll(){chat.scrollTo({top:chat.scrollHeight,behavior:'smooth'});}
function row(cls,html){const d=document.createElement('div');d.className='row '+cls;d.innerHTML=html;
  chat.appendChild(d);requestAnimationFrame(()=>{d.classList.add('on');scroll();});
  setTimeout(scroll,500);return d;}
const AV='__АВАТАР__';
async function main(){
  await sleep(700);
  // приветствие + меню
  const hello=row('bot',`<img class="av" src="${AV}"><div class="bub">
    <div class="slogan">AMBERRY раздевает и оживляет любое фото.</div>
    <div class="hint">1 коин — одно фото. Ролик 5 секунд — 5 коинов.</div>
    <div class="hint" style="margin-top:16px;color:#cfe0ee">Что делаем?</div>
    <div class="kb">
      <div class="kbrow"><div class="btn hot" id="b1">Раздеть<span class="tap" id="t1"></span></div></div>
      <div class="kbrow"><div class="btn">Видео</div><div class="btn">Свой промпт</div></div>
    </div></div>`);
  await sleep(1600);
  document.getElementById('t1').classList.add('go');
  document.getElementById('b1').style.background='linear-gradient(135deg,#ff0a8c33,#7a2bff22)';
  await sleep(900);
  // подменю
  row('bot',`<img class="av" src="${AV}"><div class="bub">Раздеть — выбери:
    <div class="kb"><div class="kbrow"><div class="btn hot sm">Соло<span class="tap go"></span></div>
    <div class="btn sm">Групповое</div></div></div></div>`);
  await sleep(1500);
  row('bot',`<img class="av" src="${AV}"><div class="bub">Пришли <b>один</b> снимок — и я сделаю фото.</div>`);
  await sleep(1100);
  // фото от пользователя
  row('me',`<img class="photo" src="__ВХОД__">`);
  await sleep(1300);
  // генерация
  const g=row('bot',`<img class="av" src="${AV}"><div class="bub">
    <div class="gen"><div class="spin"></div><div>Генерирую… <span class="timer" id="tm">0:01</span></div></div>
    <div class="prog"><i id="pg"></i></div></div>`);
  const tm=document.getElementById('tm'),pg=document.getElementById('pg');
  for(let s=1;s<=26;s++){tm.textContent='0:'+String(s).padStart(2,'0');
    pg.style.width=Math.round(s/26*100)+'%';scroll();await sleep(150);}
  await sleep(300);
  // результат приходит СРАЗУ замазанным - как будто голое фото уже
  // прислали, просто прикрыто. Никакого резкого кадра: класс hide стоит
  // с самого появления, картинка рендерится уже под мутью.
  const r=row('bot',`<img class="av" src="${AV}"><div class="bub" style="padding:14px">
    <div class="reswrap hide" id="rw"><img src="__РЕЗ__">
      <div class="px"></div><div class="frame"></div>
      <div class="cap"><img class="lg" src="__ЛОГО__">
        <div class="t">ПРОДОЛЖЕНИЕ В БОТЕ</div><div class="h">@theamberrybot</div></div>
    </div></div>`);
  scroll();await sleep(400);scroll();
  await sleep(4000);            // замазанный результат держим в кадре
  // аутро
  document.getElementById('outro').classList.add('on');
  await sleep(2600);
  window.__done=true;
}
main();
</script></body></html>"""


async def записать(html_путь, выход):
    from playwright.async_api import async_playwright
    видеокат = os.path.join(ТУТ, ".video")
    os.makedirs(видеокат, exist_ok=True)
    async with async_playwright() as p:
        бр = await p.chromium.launch(headless=True, args=["--no-sandbox",
             "--force-color-profile=srgb", "--disable-lcd-text"])
        к = await бр.new_context(viewport={"width": 1080, "height": 1920},
             record_video_dir=видеокат,
             record_video_size={"width": 1080, "height": 1920},
             device_scale_factor=1)
        стр = await к.new_page()
        await стр.goto("file://" + html_путь, wait_until="load")
        # ждём конца анимации
        for _ in range(600):
            if await стр.evaluate("()=>window.__done===true"):
                break
            await стр.wait_for_timeout(200)
        await стр.wait_for_timeout(400)
        путь_видео = await стр.video.path()
        await к.close()
        await бр.close()
    # webm -> mp4 1080x1920
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff, "-y", "-i", путь_видео,
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
                           "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-movflags", "+faststart", выход], check=True)
    os.remove(путь_видео)
    return выход


def главное(арг):
    лицо = арг[0] if арг else "ника"
    входное = арг[1]
    результат = арг[2]
    выход = арг[3] if len(арг) > 3 else os.path.join(ТУТ, "показ-%s.mp4" % лицо)
    h = html(лицо, входное, результат)
    hp = os.path.join(ТУТ, ".экран-%s.html" % лицо)
    with open(hp, "w", encoding="utf-8") as ф:
        ф.write(h)
    print("HTML собран:", hp, len(h), "байт", flush=True)
    asyncio.run(записать(hp, выход))
    print("готово:", выход, os.path.getsize(выход), "байт", flush=True)


if __name__ == "__main__":
    главное(sys.argv[1:])
