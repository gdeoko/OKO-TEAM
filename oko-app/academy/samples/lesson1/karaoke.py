#!/usr/bin/env python3
# Build karaoke ASS: correct script text (right spelling/tool names) timed by
# aligning to Whisper word timestamps (difflib), interpolating gaps.
import json, re, difflib, unicodedata

SCRIPT = [
 "Слушай. Нейросетей сейчас сотни, и новеньких выкидывают чуть ли не каждую неделю. Потеряться легко. Но есть хорошая новость: чтобы работать быстро, тебе не нужно знать их все. Нужна карта. Одна простая схема: задача, категория, модель. Давай построим её вместе и к концу урока ты будешь выбирать инструмент за пару секунд.",
 "Запомни главное правило. Сначала ты называешь задачу, а не модель. Все нейросети делятся всего на семь больших семей. Текст. Изображения. Видео. Код. Озвучка. Музыка. И автоматизация. Понял, к какой семье относится твоя задача считай, полдела сделано.",
 "Начнём с текста это твой рабочий конь. Здесь три лидера. ЧатGPT универсальный солдат, хорош почти во всём. Claude король больших текстов и кода, держит контекст на десятки страниц. Gemini когда нужен свежий поиск и связка с гуглом. Правило простое: пишешь код или длинный документ зови Клода. Нужен факт из сети Gemini. Всё остальное ЧатGPT.",
 "Дальше картинки, и вот тут крутятся деньги. Midjourney про красоту и арт, лучшая эстетика. Flux фотореализм почти бесплатно, около пяти центов за кадр. Nano Banana правки и текст прямо на картинке, без перегенерации. А Higgsfield собирает их все в одном окне. Хочешь вау-визуал Midjourney. Нужен объём и дёшево Flux.",
 "Видео самое дорогое и самое зрелищное. Veo лучшее качество и родной звук, почти как настоящий продакшн. Kling кино за копейки, примерно десять центов за секунду. Runway заточен под маркетинг и монтаж. Тестируешь идею бери Kling, он не разорит. Финалку для клиента на Veo.",
 "Три быстрых семьи. Код без программиста Cursor, Lovable, Claude Code: описываешь словами, получаешь рабочее приложение. Озвучка ElevenLabs для премиума или бесплатный edge-tts, которым, кстати, озвучен этот урок. Музыка под ролик Suno: один запрос и готовый трек у тебя в руках.",
 "А теперь лазейка, ради которой стоило досмотреть. Не плати каждой модели по отдельности. Один Higgsfield Ultra это почти безлимит десятков топовых моделей из одного окна. Посчитай: пять подписок по двадцать долларов против одной. Экономия в разы. Плюс edge-tts бесплатно и n8n на своём сервере бесплатно и себестоимость уже копейки.",
 "Собираем всю карту в одну формулу. Задача. Категория. Модель. Три шага и ты больше не тыкаешься вслепую. Текст Claude и компания. Картинки Flux и Midjourney. Видео Kling и Veo. А связка через Higgsfield бережёт твой бюджет.",
 "На следующем уроке разберём промптинг навык, который умножает всё, что ты узнал сегодня. Сохрани эту карту и возвращайся. Это была Академия OKO.",
]
SEG=[{"start":0.0,"end":28.2},{"start":28.75,"end":56.926},{"start":57.426,"end":90.282},{"start":90.782,"end":120.686},{"start":121.186,"end":146.89},{"start":147.39,"end":170.526},{"start":171.026,"end":198.026},{"start":198.526,"end":223.318},{"start":223.818,"end":236.922}]

def strip_acc(s): return ''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
def norm(w): return re.sub(r'[^0-9a-zа-яё]','',strip_acc(w).lower())

# flatten script into words with segment index
sw=[]  # (display, seg_idx)
for i,txt in enumerate(SCRIPT):
    for tok in txt.split():
        sw.append((tok,i))
sn=[norm(t[0]) for t in sw]

wh=json.load(open("words.json"))
whn=[norm(x["w"]) for x in wh]

times=[None]*len(sw)
sm=difflib.SequenceMatcher(None,sn,whn,autojunk=False)
for a,b,size in sm.get_matching_blocks():
    for k in range(size):
        times[a+k]=[wh[b+k]["t"],wh[b+k]["e"]]

# interpolate missing using neighbors, clamp within segment window
def seg_win(i): s=SEG[sw[i][1]]; return s["start"],s["end"]
# forward fill anchors
n=len(sw)
for i in range(n):
    if times[i] is None:
        # find prev and next known
        p=i-1
        while p>=0 and times[p] is None: p-=1
        q=i+1
        while q<n and times[q] is None: q+=1
        ws,we=seg_win(i)
        pt = times[p][1] if p>=0 else ws
        nt = times[q][0] if q<n else we
        # count gap span
        span=(q-p) if (p>=0 and q<n) else max(1,(q-p))
        frac=(i-p)/span if span else 0
        t=pt+(nt-pt)*frac
        times[i]=[t,t+0.28]
# enforce monotonic + clamp to segment
for i in range(n):
    ws,we=seg_win(i)
    t,e=times[i]
    t=max(ws,min(t,we-0.15)); e=max(t+0.12,min(e,we))
    if i>0 and t<times[i-1][0]: t=times[i-1][0]+0.02; e=max(t+0.12,e)
    times[i]=[t,e]

# group into karaoke lines of up to 3 words (not crossing segment)
lines=[]; cur=[]
for i in range(n):
    if cur and (sw[i][1]!=sw[cur[0]][1] or len(cur)>=3):
        lines.append(cur); cur=[]
    cur.append(i)
if cur: lines.append(cur)

def ass_t(x):
    cs=int(round(x*100)); h=cs//360000; cs%=360000; m=cs//6000; cs%=6000; s=cs//100; cc=cs%100
    return f"{h}:{m:02d}:{s:02d}.{cc:02d}"

LIME="&H0006F89A&"  # AABBGGRR -> lime #9AFF00  (B=00,G=FF,R=9A) => &H0000FF9A& ; with alpha 00
ACT="&H0000FF9A&"; WHITE="&H00F0F8F4&"
head=r"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kar,Montserrat,66,&H00F0F8F4,&H00F0F8F4,&H00000000,&H64000000,-1,0,0,0,100,100,0.6,0,1,0,5,2,120,120,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev=[]
for ln in lines:
    for pos,i in enumerate(ln):
        t,e=times[i]
        # cap end at next word start in same line/next
        nxt = times[i+1][0] if i+1<n and sw[i+1][1]==sw[i][1] else e
        end=max(t+0.12, min(e+0.05, nxt))
        parts=[]
        for pos2,j in enumerate(ln):
            w=sw[j][0]
            if j==i: parts.append(r"{\c"+ACT+r"\b1}"+w+r"{\r}")
            else: parts.append(r"{\c&H00C8D2BE&}"+w+r"{\r}")
        txt=" ".join(parts)
        ev.append(f"Dialogue: 0,{ass_t(t)},{ass_t(end)},Kar,,0,0,0,,{txt}")
open("subs.ass","w").write(head+"\n".join(ev)+"\n")
print(f"{len(sw)} script words, {len(lines)} lines, {len(ev)} events")
