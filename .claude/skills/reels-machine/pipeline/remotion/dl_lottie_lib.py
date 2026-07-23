#!/usr/bin/env python3
"""Качает профи-Lottie из LottieFiles GraphQL (без ключа) в public/lib/.
Категории -> запросы; берёт первые валидные (с layers). Регистрируется в src/lottieLib.ts."""
import json,subprocess,os
def gql(q,n=6):
    body=json.dumps({"query":"query($q:String!,$n:Int!){searchPublicAnimations(query:$q,first:$n){edges{node{name jsonUrl}}}}","variables":{"q":q,"n":n}})
    out=subprocess.run(["curl","-s","--max-time","30","-X","POST","https://graphql.lottiefiles.com/2022-08","-H","Content-Type: application/json","-d",body],capture_output=True).stdout
    try: return [e["node"] for e in json.loads(out)["data"]["searchPublicAnimations"]["edges"]]
    except: return []
def dl(url,path):
    subprocess.run(["curl","-s","--max-time","40","-o",path,url])
    try:
        j=json.load(open(path));  return "layers" in j and bool(j.get("w"))
    except:
        if os.path.exists(path): os.remove(path)
        return False
CATS={"trans":["swipe transition"],"burst":["confetti explosion"],"check":["checkmark success"],
      "arrow":["arrow swipe up"],"bell":["notification bell subscribe"],"loader":["loading circle neon"],
      "money":["money growth coins"],"fire":["fire flame trending"]}
os.makedirs("public/lib",exist_ok=True)
for cat,qs in CATS.items():
    got=0
    for q in qs:
        for node in gql(q,6):
            if got>=2: break
            if dl(node["jsonUrl"],f"public/lib/{cat}{got+1}.json"): print("OK",cat,got+1); got+=1
print("done")
