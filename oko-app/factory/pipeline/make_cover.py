import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
D=os.environ.get("FACTORY_ROOT","/home/user/OKO-TEAM/oko-app/factory")
W=os.environ.get("REEL_W",os.getcwd()); F=os.environ.get("FACTORY_FONTS",D+"/fonts")
AMBER=(234,89,32); AMBER2=(255,138,72); WHITE=(246,244,241); INK=(12,10,8)
m9=lambda s: ImageFont.truetype(F+"/montserrat-v31-cyrillic_latin-900.ttf",s)
m7=lambda s: ImageFont.truetype(F+"/montserrat-v31-cyrillic_latin-700.ttf",s)
man=lambda s: ImageFont.truetype(F+"/manrope-v20-cyrillic_latin-800.ttf",s)
# --- background: hero excavator frame, cinematic grade ---
bg=Image.open(W+"/cover_cand/b07.jpg").convert("RGB").resize((1080,1920),Image.LANCZOS)
bg=ImageEnhance.Contrast(bg).enhance(1.12); bg=ImageEnhance.Color(bg).enhance(1.15)
# gradient scrim bottom->up + top slight
scrim=Image.new("L",(1080,1920),0); sd=ImageDraw.Draw(scrim)
for y in range(1920):
    a=0
    if y>760: a=int(min(236,(y-760)/(1920-760)*255))
    if y<360: a=max(a,int((360-y)/360*130))
    sd.line([(0,y),(1080,y)],fill=a)
bg=Image.composite(Image.new("RGB",(1080,1920),(6,6,9)),bg,scrim)
d=ImageDraw.Draw(bg)
# --- top brand row: real logo + wordmark ---
logo=Image.open(os.environ.get("FACTORY_LOGO",D+"/logo_hd.png")).convert("RGBA")
lr=logo.resize((120,120),Image.LANCZOS); bg.paste(lr,(70,80),lr)
d.text((205,96),"DIESEL",font=m9(58),fill=WHITE)
d.text((205,158),"CARGO",font=m7(38),fill=AMBER2)
def fit(txt,fn,sz,maxw):
    s=sz
    while s>10 and d.textlength(txt,font=fn(s))>maxw: s-=2
    return fn(s)
MAXW=940
# --- eyebrow ---
d.text((72,1120),"ПРОВЕРКА · ГАРАНТИЯ · СЕРВИС · ЗАПЧАСТИ",font=man(30),fill=AMBER2)
# --- title ---
tf=fit("ТЕХНИКА С",m9,128,MAXW)
d.text((68,1172),"ТЕХНИКА С",font=tf,fill=WHITE)
d.text((68,1304),"ГАРАНТИЕЙ",font=m9(128),fill=WHITE)
# amber underline accent
d.rounded_rectangle([74,1466,470,1482],8,fill=AMBER)
d.text((72,1504),"ИЗ КИТАЯ · ПОД КЛЮЧ",font=fit("ИЗ КИТАЯ · ПОД КЛЮЧ",m9,62,MAXW),fill=AMBER2)
# --- value pill (process, not a made-up price) ---
label="ЗАВОД · ТАМОЖНЯ · ДОСТАВКА"
pf=m7(44); pw=d.textlength(label,font=pf)+96; x0=72
d.rounded_rectangle([x0,1610,x0+pw,1610+112],32,fill=AMBER)
d.text((x0+48,1642),label,font=pf,fill=INK)
# --- sub line ---
d.text((72,1782),"страхование груза · оформление · документы на учёт",font=man(33),fill=WHITE)
# watermark
d.text((72,1858),"dieselcompany.pro",font=m7(34),fill=(210,205,200))
bg.save(W+"/cover.jpg",quality=93)
print("cover ok", os.path.getsize(W+"/cover.jpg")//1024,"KB")
