import json,re,sys
sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from лента import get, txt
SEL={
"18+ и эротика":"ru2ch_ban random_porn assmilfhots slapassmilf hubmilfs alt4wka_fans geennt1 cumoffface Japanese_porn_Number_1 bigassbbc bigasswomenxxx butdaaady dvach18 hentaigamess tits_tweeets trivialstoryfromlife nochnajaskazkka vosbudget komnata pussycat_pics delightov iwaantyoouu iwantupronvideosseks sapiscience manhvssp khentayle_komiksix_mangar_anime playcommics shittcomics palata6_tg retroharbor0 asian_beauty_k",
"Мужской юмор и двач":"leoday memachh dvachannel why4ch telegrachan ru4chan ru4chan18 rand2ch zhiga pezduza pezduzalive Lepragram mudak Mdk_pr yaplakal pozorstan prikoly_humor_memy xazayeva tupi4ek_degradanta a_necdot69 twitt_ota huyvrot88 rushizik theohdaily video_dolboeba prikoly pikabu hahazerg memeute ptenetstg stlbnkoff evo_memy",
"Сетка Топора":"toporlive",
}
base={r["u"]:r for r in json.load(open('/tmp/aud/a1.json'))}
from лента import audit
out=[]
for cat,names in SEL.items():
    for u in names.split():
        r=base.get(u) or {"u":u,"cats":[],"reach_tgstat":"","subs":0}
        if u not in base: r.update(audit(u))
        r["group"]=cat
        # рекламные контакты из постов
        s=get("https://t.me/s/"+u)
        ad=set()
        for line in re.findall(r"[^\n<>]{0,60}(?:реклам|сотруднич|по вопросам|adv|ads)[^\n<>]{0,80}",txt(s),re.I):
            ad.update(c for c in re.findall(r"@([A-Za-z0-9_]{4,})",line) if c.lower()!=u.lower())
        for line in re.findall(r"[^\n]{0,60}(?:реклам|сотруднич|по вопросам|adv|ads)[^\n]{0,80}",r.get("desc",""),re.I):
            ad.update(c for c in re.findall(r"@([A-Za-z0-9_]{4,})",line) if c.lower()!=u.lower())
        r["ad_contacts"]=sorted(ad)
        out.append(r)
json.dump(out,open('/tmp/aud/sel.json','w'),ensure_ascii=False,default=str)
print(len(out))
for r in out: print(r["u"], r.get("subs"), r.get("avg"), r["ad_contacts"], r["contacts"][:4])
