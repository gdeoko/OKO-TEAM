import os, json, urllib.request, urllib.parse, ssl

ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt") if os.path.exists("/root/.ccr/ca-bundle.crt") else ssl.create_default_context()
PIX = os.environ["PIXABAY_API_KEY"]; FS = os.environ["FREESOUND_API_KEY"]
os.makedirs("public/fx", exist_ok=True); os.makedirs("public/sfx", exist_ok=True); os.makedirs("public/lottie", exist_ok=True)

def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=timeout, context=ctx).read()

def dl(url, path):
    try:
        d = get(url)
        open(path,"wb").write(d); print(f"OK {path} {len(d)//1024}KB"); return True
    except Exception as e:
        print(f"FAIL {path}: {e}"); return False

# ---------- Pixabay VIDEO overlays / backgrounds ----------
PIX_VIDS = {
  "leak_warm":   "light leak",
  "leak_lens":   "lens flare",
  "particles_gold":"gold particles",
  "particles_dust":"dust particles",
  "bokeh":       "bokeh lights",
  "glitch":      "glitch transition",
  "smoke":       "smoke black background",
  "network":     "digital network connection",
  "neon_bg":     "abstract neon background",
  "grid_bg":     "technology grid background",
  "confetti":    "confetti explosion",
  "film_burn":   "film burn",
}
for name, q in PIX_VIDS.items():
    dst = f"public/fx/{name}.mp4"
    if os.path.exists(dst): print("skip", dst); continue
    try:
        u = f"https://pixabay.com/api/videos/?key={PIX}&q={urllib.parse.quote(q)}&per_page=5&safesearch=true"
        data = json.loads(get(u))
        hits = data.get("hits", [])
        if not hits: print("no hits", q); continue
        # prefer a short-ish clip, medium resolution
        hits.sort(key=lambda h: abs(h.get("duration",10)-8))
        v = hits[0]["videos"]
        url = (v.get("medium") or v.get("small") or v.get("large"))["url"]
        dl(url, dst)
    except Exception as e:
        print("PIXFAIL", name, e)

# ---------- Freesound SFX (public preview mp3s) ----------
FS_Q = {
  "whoosh1":"whoosh transition","whoosh2":"swoosh fast","impact1":"cinematic impact hit",
  "boom":"cinematic boom sub","riser":"riser build up","click":"ui click",
  "pop":"pop ui","cash":"cash register money","ding":"success notification",
  "glitch_sfx":"glitch digital","sweep":"transition sweep",
}
for name, q in FS_Q.items():
    dst = f"public/sfx/{name}.mp3"
    if os.path.exists(dst): print("skip", dst); continue
    try:
        u = f"https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(q)}&token={FS}&page_size=4&fields=id,name,previews,duration&filter=duration:[0.1 TO 6]"
        data = json.loads(get(u))
        res = data.get("results", [])
        if not res: print("no sfx", q); continue
        prev = res[0]["previews"]["preview-hq-mp3"]
        dl(prev, dst)
    except Exception as e:
        print("FSFAIL", name, e)

# ---------- Lottie JSON motion assets ----------
LOTTIE = {
  # lottiefiles community packages (public CDN)
  "coins":   "https://assets9.lottiefiles.com/packages/lf20_touohxv0.json",
  "success": "https://assets2.lottiefiles.com/packages/lf20_jcikwtux.json",
  # lordicon free animated icons
  "icon_a":  "https://cdn.lordicon.com/wxnxiano.json",
}
for name, url in LOTTIE.items():
    dst = f"public/lottie/{name}.json"
    if os.path.exists(dst): print("skip", dst); continue
    dl(url, dst)

print("=== DONE ===")
print("fx:", os.listdir("public/fx"))
print("sfx:", os.listdir("public/sfx"))
print("lottie:", os.listdir("public/lottie"))
