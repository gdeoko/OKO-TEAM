import os,urllib.parse,urllib.request,io
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
# AI cover via FLUX (Pollinations, free) + brand composite. Env:
#  COVER_PROMPT (scene, no text), COVER_EYEBROW, COVER_T1, COVER_T2, COVER_SUB, COVER_PILL
D=os.environ.get("FACTORY_ROOT","/home/user/OKO-TEAM/oko-app/factory")
W=os.environ.get("REEL_W",os.getcwd()); F=os.environ.get("FACTORY_FONTS",D+"/fonts")
AMBER=(234,89,32);AMBER2=(255,138,72);WHITE=(246,244,241);INK=(12,10,8)
m9=lambda s:ImageFont.truetype(F+"/montserrat-v31-cyrillic_latin-900.ttf",s)
m7=lambda s:ImageFont.truetype(F+"/montserrat-v31-cyrillic_latin-700.ttf",s)
man=lambda s:ImageFont.truetype(F+"/manrope-v20-cyrillic_latin-800.ttf",s)
scene=os.environ.get("COVER_PROMPT","premium vehicle, dramatic studio lighting, dark background, amber orange accent light, reflective floor, photorealistic, no text")
prompt=f"cinematic vertical 9:16 poster, {scene}, moody cinematic, amber orange accent 234-89-32, high detail, professional product photography, no text, no watermark"
enc=urllib.parse.quote(prompt)
seed=os.environ.get("COVER_SEED","7")
url=f"https://image.pollinations.ai/prompt/{enc}?width=1080&height=1920&model=flux&nologo=true&seed={seed}"
bg=None
for attempt in range(4):
    try:
        u=url+("" if attempt==0 else f"&r={attempt}")
        raw=urllib.request.urlopen(u,timeout=90).read()
        if len(raw)>25000:
            bg=Image.open(io.BytesIO(raw)).convert("RGB").resize((1080,1920),Image.LANCZOS)
            print("FLUX bg ok attempt",attempt); break
    except Exception as e:
        print("flux retry",attempt,str(e)[:60])
if bg is None:
    # fallback: stock frame cover_cand/*.jpg (from footage) or brand gradient — build never breaks
    import glob
    cc=sorted(glob.glob(W+"/cover_cand/*.jpg"))
    if cc:
        bg=Image.open(cc[0]).convert("RGB").resize((1080,1920),Image.LANCZOS); print("FLUX failed -> stock-frame fallback")
    else:
        bg=Image.new("RGB",(1080,1920),(14,10,8)); print("FLUX failed -> gradient fallback")
bg=ImageEnhance.Contrast(bg).enhance(1.06)
# scrim bottom for text
scrim=Image.new("L",(1080,1920),0); sd=ImageDraw.Draw(scrim)
for y in range(1920):
    a=0
    if y>820: a=int(min(238,(y-820)/(1920-820)*255))
    if y<330: a=max(a,int((330-y)/330*120))
    sd.line([(0,y),(1080,y)],fill=a)
bg=Image.composite(Image.new("RGB",(1080,1920),(6,6,9)),bg,scrim)
d=ImageDraw.Draw(bg)
logo=Image.open(os.environ.get("FACTORY_LOGO",D+"/logo_hd.png")).convert("RGBA").resize((120,120),Image.LANCZOS)
bg.paste(logo,(70,80),logo)
d.text((205,96),"DIESEL",font=m9(58),fill=WHITE); d.text((205,158),"CARGO",font=m7(38),fill=AMBER2)
def fit(t,fn,sz,mx):
    while sz>10 and d.textlength(t,font=fn(sz))>mx: sz-=2
    return fn(sz)
MX=940
d.text((72,1120),os.environ.get("COVER_EYEBROW","ИЗ КИТАЯ · ПОД КЛЮЧ"),font=man(30),fill=AMBER2)
t1=os.environ.get("COVER_T1","ТЕХНИКА"); t2=os.environ.get("COVER_T2","ИЗ КИТАЯ")
d.text((68,1172),t1,font=fit(t1,m9,128,MX),fill=WHITE)
d.text((68,1304),t2,font=fit(t2,m9,128,MX),fill=WHITE)
d.rounded_rectangle([74,1466,470,1482],8,fill=AMBER)
sub=os.environ.get("COVER_SUB","ПОД КЛЮЧ С ДОСТАВКОЙ")
d.text((72,1504),sub,font=fit(sub,m9,62,MX),fill=AMBER2)
pill=os.environ.get("COVER_PILL","ЗАВОД · ТАМОЖНЯ · ДОСТАВКА")
pf=m7(44);pw=d.textlength(pill,font=pf)+96
d.rounded_rectangle([72,1610,72+pw,1722],32,fill=AMBER); d.text((120,1642),pill,font=pf,fill=INK)
d.text((72,1858),"dieselcompany.pro",font=m7(34),fill=(210,205,200))
bg.save(W+"/cover.jpg",quality=93)
print("FLUX cover ok",os.path.getsize(W+"/cover.jpg")//1024,"KB")
