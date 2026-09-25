import re, html, json, time, statistics, sys, concurrent.futures as cf, datetime as dt
import urllib.request
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
def get(url):
    for i in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"ru"}),timeout=30)
            return r.read().decode("utf-8","replace")
        except Exception as e:
            time.sleep(2+i*3)
    return ""
def num(s):
    s=s.strip().replace(" ","").replace(",",".")
    m=re.match(r"([\d.]+)([KM]?)",s)
    if not m: return 0
    v=float(m.group(1)); return int(v*{"":1,"K":1e3,"M":1e6}[m.group(2)])
def txt(h): return html.unescape(re.sub(r"<br\s*/?>","\n",re.sub(r"<(?!br)[^>]+>","",h))).strip()
def audit(u):
    p=get("https://t.me/"+u); s=get("https://t.me/s/"+u)
    r={"u":u}
    m=re.search(r'<div class="tgme_page_title"[^>]*>(.*?)</div>',p,re.S); r["title"]=txt(m.group(1)) if m else ""
    m=re.search(r'<div class="tgme_page_description[^"]*"[^>]*>(.*?)</div>',p,re.S); r["desc"]=txt(m.group(1)) if m else ""
    m=re.search(r'<div class="tgme_page_extra">([^<]*)</div>',p); ex=m.group(1) if m else ""
    m=re.search(r'([\d\s]+)\s*(subscribers|подписчик)',ex.replace("\xa0"," ")); r["subs"]=int(m.group(1).replace(" ","")) if m else 0
    posts=[]
    for blk in re.split(r'<div class="tgme_widget_message_wrap',s)[1:]:
        v=re.search(r'tgme_widget_message_views">([^<]+)<',blk)
        d=re.search(r'<time datetime="([^"]+)"',blk)
        t=re.search(r'tgme_widget_message_text[^>]*>(.*?)</div>',blk,re.S)
        if not d: continue
        posts.append({"v":num(v.group(1)) if v else None,"d":dt.datetime.fromisoformat(d.group(1)),"t":txt(t.group(1)) if t else ""})
    now=dt.datetime.now(dt.timezone.utc)
    r["n"]=len(posts)
    if posts:
        r["last_h"]=round((now-posts[-1]["d"]).total_seconds()/3600,1)
        span=(posts[-1]["d"]-posts[0]["d"]).total_seconds()/86400
        r["per_day"]=round(len(posts)/span,1) if span>0.2 else len(posts)
        mat=[x["v"] for x in posts if x["v"] and (now-x["d"]).total_seconds()>86400]
        if len(mat)<3: mat=[x["v"] for x in posts if x["v"]]
        if mat:
            r["avg"]=int(statistics.mean(mat)); r["med"]=int(statistics.median(mat))
            r["cv"]=round(statistics.pstdev(mat)/statistics.mean(mat),2) if len(mat)>2 else None
        ads=sum(1 for x in posts if re.search(r"#реклама|erid|реклама\b|#ad\b|partner",x["t"],re.I))
        r["ads"]=ads
    alltext=(r["title"]+" "+r["desc"])
    r["contacts"]=sorted(set(c for c in re.findall(r"@([A-Za-z0-9_]{4,})",r["desc"]) if c.lower()!=u.lower()))
    r["links"]=sorted(set(re.findall(r"https?://[^\s]+",r["desc"])))
    r["price_hint"]=re.findall(r"[^\n]{0,40}(?:\d[\d\s]*₽|\d[\d\s]*руб|\$\d+)[^\n]{0,20}",r["desc"])
    return r
if __name__=="__main__":
  cands=json.load(open(sys.argv[1]))
  out=[]
  with cf.ThreadPoolExecutor(6) as ex:
    for r in ex.map(lambda c: {**c, **audit(c["u"])}, cands):
        out.append(r); print(r["u"], r.get("subs"), r.get("avg"), r.get("last_h"), flush=True)
  json.dump(out,open(sys.argv[2],"w"),ensure_ascii=False,default=str)
