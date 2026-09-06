# -*- coding: utf-8 -*-
# Рендер оверлеев для 5 роликов: titles.mov (кинетические заголовки по ключевому слову) +
# accents.mov (кодовая анимированная инфографика). Механика build_accents/build_titles + capture.js.
# У каждого ролика свой набор механик, свой OVL_STYLE, данные ТОЛЬКО из паспорта, каждый экземпляр уникален.
import os, json, subprocess, re, shutil
ROOT="/home/user/OKO-TEAM/oko-app/factory"
PIPE=ROOT+"/pipeline"
NM="/home/user/OKO-TEAM/node_modules"
CHROME=None
for d in sorted(os.listdir("/opt/pw-browsers")):
    if re.match(r"chromium-[0-9]+$", d): CHROME=f"/opt/pw-browsers/{d}/chrome-linux/chrome"
FONTS=ROOT+"/fonts"; LOGO=ROOT+"/logo_hd.png"
OUT=ROOT+"/overlays2"; os.makedirs(OUT, exist_ok=True)

def vdur(r):
    o=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"{ROOT}/voices2/{r}.mp3"],capture_output=True,text=True).stdout.strip()
    return float(o) if o else 30.0

# заголовки по ключевому слову (2 строки), 6 на ролик; цифры на экране можно (паспорт)
TITLES={
 "R1":[["35 ДНЕЙ","ЖДАЛ"],["ВОТ","ОНО"],["БЕЗ","ЦАРАПИН"],["ТАМОЖНЮ","ПРОШЛИ САМИ"],["НОЛЬ","ДОПЛАТ"],["ГОРОД","В ЛИЧКУ"]],
 "R2":[["НОЛЬ","ДОПЛАТ"],["3,5 $","ЗА КГ"],["ТАМОЖНЯ","В ЦЕНЕ"],["20-38 %","НАЦЕНКА"],["ЭПСМ","ЭПТС"],["ГОРОД","В ЛИЧКУ"]],
 "R3":[["ДОКУМЕНТЫ?","ПО ШАГАМ"],["ШАГ ОДИН","ОФОРМЛЕНИЕ"],["ШАГ ДВА","БУМАГИ В ПУТИ"],["ШАГ ТРИ","ТАМОЖНЯ В ЦЕНЕ"],["ШАГ ЧЕТЫРЕ","ГАРАНТИЯ ГОД"],["ГОРОД","В ЛИЧКУ"]],
 "R4":[["11 310 $","ПОД КЛЮЧ"],["LONCIN","XWOLF 1000"],["ЗАВОД","НАПРЯМУЮ"],["3,5 $","ЗА КГ"],["ТАМОЖНЯ","ВНУТРИ"],["ГОРОД","В ЛИЧКУ"]],
 "R5":[["НАЗОВИ","ГОРОД"],["КВАДРО ГИДРО","СНЕГО БАГГИ"],["LONCIN CF MOTO","BRP AODES"],["ОТ 500 000 ₽","МИН 100 000"],["ГАРАНТИЯ","ГОД"],["ПОД КЛЮЧ","СЕГОДНЯ"]],
}
# наборы инфографики (данные только паспортные, каждый экземпляр уникален по тексту/числам)
ACC={
 "R1":[("odometer",{"to":35,"suf":" ДНЕЙ","label":"ОЖИДАНИЕ ЗАКОНЧИЛОСЬ"}),("ring",{"val":100,"label":"ДОСТАВЛЕНО"}),
       ("ticks",{"items":["ЗАКУПКА","В ПУТИ","У ВАС ВО ДВОРЕ"]}),("stamp",{"a":"ТАМОЖНЯ","b":"ПРОЙДЕНА"}),
       ("iconrow",{"items":["ЗАКУПКА","ЛОГИСТИКА","ТАМОЖНЯ"]}),("lowerthird",{"label":"ЦЕЛОЙ","val":"без единой царапины"})],
 "R2":[("vs",{"a":"САМ ВЕЗЁШЬ","av":"ЖДЁШЬ И ДОПЛАТА","b":"ПОД КЛЮЧ","bv":"ТАМОЖНЯ В ЦЕНЕ"}),
       ("chips",{"items":["ФИКС","ЗАКОННО","ЭПСМ / ЭПТС"]}),("badge",{"txt":"3,5 $ ЗА КГ","arrow":True}),
       ("bar",{"label":"НАЦЕНКА","val":"20-38 %","fill":0.4}),("donut",{"val":100,"label":"ТАМОЖНЯ В ЦЕНЕ"}),
       ("lowerthird",{"label":"ФИКС","val":"цена известна до старта"})],
 "R3":[("iconrow",{"items":["ШАГ 1","ШАГ 2","ШАГ 3","ШАГ 4"]}),
       ("ticks",{"items":["ОФОРМЛЕНИЕ","БУМАГИ В ДОРОГЕ","ТАМОЖНЯ В ЦЕНЕ","ГАРАНТИЯ ГОД"]}),
       ("chips",{"items":["СПОРТИНВЕНТАРЬ","ЭПСМ","ЭПТС"]}),("badge",{"txt":"ГАРАНТИЯ 1 ГОД","arrow":True}),
       ("ring",{"val":100,"label":"ОФОРМЛЕНО"}),("lowerthird",{"label":"НА УЧЁТ","val":"технику принимают без вопросов"})],
 "R4":[("bigstat",{"num":"11 310 $","label":"ПОД КЛЮЧ ДО МОСКВЫ"}),("route",{"a":"КИТАЙ","b":"МОСКВА"}),
       ("odometer",{"to":500,"suf":" 000 ₽","label":"ТЕХНИКА ОТ"}),("bar",{"label":"НАЦЕНКА ЧЕСТНАЯ","val":"20-38 %","fill":0.4}),
       ("donut",{"val":100,"label":"БЕЗ ВОЗДУХА"}),("lowerthird",{"label":"MUD","val":"loncin xwolf 1000"})],
 "R5":[("iconrow",{"items":["КВАДРО","ГИДРО","СНЕГО"]}),("chips",{"items":["БАГГИ","СПЕЦТЕХНИКА","ЭЛЕКТРО"]}),
       ("badge",{"txt":"ГАРАНТИЯ ГОД","arrow":True}),("stamp",{"a":"ПОД","b":"КЛЮЧ"}),
       ("bigstat",{"num":"ОТ 500 000 ₽","label":"МИН ЗАКАЗ 100 000"}),("lowerthird",{"label":"БРЕНДЫ","val":"loncin · cf moto · brp · aodes"})],
}
STYLE_BY={"R1":0,"R2":1,"R3":2,"R4":3,"R5":4}

def render(reel):
    dur=vdur(reel); W=f"{OUT}/{reel}";
    if os.path.exists(W): shutil.rmtree(W)
    os.makedirs(f"{W}/ig/html", exist_ok=True); os.makedirs(f"{W}/fr", exist_ok=True)
    for f in ["build_titles.py","build_accents.py","capture.js","ru_stress_dict.py"]:
        shutil.copy(f"{PIPE}/{f}", f"{W}/{f}")
    open(f"{W}/package.json","w").write('{"type":"commonjs"}')
    # оба скрипта читают W/words.json для TOTAL — пишем ДО запуска, иначе краш и захват старого html
    json.dump({"total":dur}, open(f"{W}/words.json","w"))
    N=int(dur*30)
    env=dict(os.environ, FACTORY_ROOT=ROOT, FACTORY_FONTS=FONTS, FACTORY_LOGO=LOGO,
             NODE_PATH=NM, REEL_W="1080", PLAYWRIGHT_BROWSERS_PATH="/opt/pw-browsers")
    # --- titles ---
    beats=TITLES[reel]; nb=len(beats); seg=dur/nb; out=[]
    for i,lines in enumerate(beats):
        s=round(i*seg+0.2,2); e=round(i*seg+seg-0.15,2)
        y=1180 if i==nb-1 else 760
        out.append({"lines":[x.upper() for x in lines],"accent":(i%2)+1,"start":s,"end":e,"y":y})
    tp=f"{W}/build_titles.py"; txt=open(tp).read()
    new="TITLES=[\n"+"".join(" "+json.dumps(o,ensure_ascii=False)+",\n" for o in out)+"]"
    txt=re.sub(r"TITLES=\[.*?\n\]", new, txt, count=1, flags=re.S); open(tp,"w").write(txt)
    subprocess.run(["python3",tp],env=env,cwd=W,capture_output=True)
    subprocess.run(["node",f"{W}/capture.js",f"{W}/ig/html/titles.html",str(N),f"{W}/fr"],env=env,cwd=W,capture_output=True,timeout=1200)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-start_number","0","-i",f"{W}/fr/f%03d.png","-c:v","qtrle","-pix_fmt","argb",f"{W}/titles.mov"],capture_output=True)
    shutil.rmtree(f"{W}/fr"); os.makedirs(f"{W}/fr")
    # --- accents ---
    accs=[]; aseg=dur/len(ACC[reel])
    for i,(typ,data) in enumerate(ACC[reel]):
        t=round(i*aseg+0.4,2); e=round(i*aseg+aseg-0.3,2)
        a={"t":t,"e":e,"type":typ,"data":data}
        if typ in ("route","stamp","bigstat","badge"): a["x"]="c"
        accs.append(a)
    env["OVL_A"]=json.dumps(accs,ensure_ascii=False); env["OVL_STYLE"]=str(STYLE_BY[reel])
    subprocess.run(["python3",f"{W}/build_accents.py"],env=env,cwd=W,capture_output=True)
    if os.path.exists(f"{W}/ig/html/accents.html"):
        subprocess.run(["node",f"{W}/capture.js",f"{W}/ig/html/accents.html",str(N),f"{W}/fr"],env=env,cwd=W,capture_output=True,timeout=1200)
        subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-start_number","0","-i",f"{W}/fr/f%03d.png","-c:v","qtrle","-pix_fmt","argb",f"{W}/accents.mov"],capture_output=True)
        shutil.rmtree(f"{W}/fr")
    t_ok=os.path.exists(f"{W}/titles.mov") and os.path.getsize(f"{W}/titles.mov")>10000
    a_ok=os.path.exists(f"{W}/accents.mov") and os.path.getsize(f"{W}/accents.mov")>10000
    print(reel,"titles",t_ok,"accents",a_ok,"dur",round(dur,1),flush=True)

for r in ["R1","R2","R3","R4","R5"]:
    try: render(r)
    except Exception as e: print(r,"ERR",repr(e)[:150],flush=True)
print("OVERLAYS_DONE")
