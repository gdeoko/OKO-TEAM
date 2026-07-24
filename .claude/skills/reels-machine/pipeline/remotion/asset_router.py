#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKO Asset Router — единая точка доступа к 12+ библиотекам монтажа.
По ключевому слову сцены тянет РАЗНЫЕ ассеты под смысл, с дедупом (не повторяется).
Все запросы — через curl (urllib/node ходят мимо прокси). Ключи — из окружения.

Использование:
    from asset_router import Router
    r = Router("public/assets")
    r.video("money counting")          # Pexels -> Pixabay
    r.sticker("fire")                   # GIPHY (mp4) + Telegram (.tgs=Lottie)
    r.animation("confetti")             # LottieFiles (json)
    r.icon("rocket")                    # Iconify (svg, 200k иконок)
    r.sfx("whoosh")                     # Freesound
    r.music("cinematic uplifting")      # Pixabay Music / Openverse / Internet Archive
    r.image("chrome 3d")               # Openverse / Wikimedia / Pexels
    r.emoji_anim("1f680")               # Google Noto animated emoji (gif)
    r.emoji_3d("Rocket")               # Microsoft Fluent 3D emoji (png)
"""
import os, json, subprocess, urllib.parse, hashlib

def _env(k): return os.environ.get(k, "")

def curl(url, headers=None, t=40, post=None):
    c = ["curl", "-sL", "--max-time", str(t)]
    for h in (headers or []): c += ["-H", h]
    if post is not None: c += ["-X", "POST", "-d", post]
    c += [url]
    return subprocess.run(c, capture_output=True).stdout

def _j(b):
    try: return json.loads(b)
    except Exception: return {}

class Router:
    def __init__(self, outdir="public/assets"):
        self.out = outdir; os.makedirs(outdir, exist_ok=True)
        self.seen = set()  # дедуп по url
        self.PEXELS = _env("PEXELS_API_KEY"); self.PIX = _env("PIXABAY_API_KEY")
        self.FS = _env("FREESOUND_API_KEY"); self.GIPHY = _env("GIPHY_API_KEY") or "GlVGYHkr3WSBnllca54iNt0yFbjz7L65"
        self.TG = _env("TELEGRAM_BOT_TOKEN") or _env("BOT_TOKEN")

    def _save(self, url, name, t=60):
        if not url or url in self.seen: return None
        self.seen.add(url)
        ext = url.split("?")[0].split(".")[-1][:4] or "bin"
        path = os.path.join(self.out, f"{name}.{ext}")
        subprocess.run(["curl", "-sL", "--max-time", str(t), "-o", path, url])
        return path if os.path.exists(path) and os.path.getsize(path) > 800 else None

    # ---------- ВИДЕО (Pexels -> Pixabay) ----------
    def video(self, q, portrait=True, name=None):
        name = name or "vid_" + hashlib.md5(q.encode()).hexdigest()[:6]
        u = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&per_page=8" + ("&orientation=portrait" if portrait else "")
        for v in _j(curl(u, [f"Authorization: {self.PEXELS}"])).get("videos", []):
            fs = [f for f in v["video_files"] if 1080 <= f.get("height", 0) <= 1920]
            fs.sort(key=lambda f: abs(f["height"] - 1600))
            if fs and fs[0]["link"] not in self.seen:
                p = self._save(fs[0]["link"], name);
                if p: return p
        # fallback Pixabay
        for h in _j(curl(f"https://pixabay.com/api/videos/?key={self.PIX}&q={urllib.parse.quote(q)}&per_page=5")).get("hits", []):
            v = h["videos"]; link = (v.get("medium") or v.get("small") or {}).get("url")
            p = self._save(link, name)
            if p: return p
        return None

    # ---------- СТИКЕРЫ (GIPHY mp4 + Telegram .tgs->Lottie) ----------
    def sticker(self, q, name=None):
        name = name or "stk_" + hashlib.md5(q.encode()).hexdigest()[:6]
        d = _j(curl(f"https://api.giphy.com/v1/stickers/search?api_key={self.GIPHY}&q={urllib.parse.quote(q)}&limit=5&rating=pg"))
        for g in d.get("data", []):
            url = g["images"]["original"].get("mp4") or g["images"]["original"].get("url")
            p = self._save(url, name)
            if p: return p
        return None

    def telegram_pack(self, pack, limit=8):
        """Скачивает .tgs-стикеры пака и распаковывает в Lottie JSON. Возвращает список путей."""
        import gzip
        out = []
        d = _j(curl(f"https://api.telegram.org/bot{self.TG}/getStickerSet?name={pack}"))
        for i, s in enumerate(d.get("result", {}).get("stickers", [])[:limit]):
            fp = _j(curl(f"https://api.telegram.org/bot{self.TG}/getFile?file_id={s['file_id']}"))
            path = fp.get("result", {}).get("file_path", "")
            if not path.endswith(".tgs"): continue
            raw = curl(f"https://api.telegram.org/file/bot{self.TG}/{path}")
            try:
                js = gzip.decompress(raw)
                dst = os.path.join(self.out, f"tg_{pack}_{i}.json"); open(dst, "wb").write(js); out.append(dst)
            except Exception: pass
        return out

    # ---------- LOTTIE-АНИМАЦИИ (LottieFiles GraphQL) ----------
    def animation(self, q, name=None):
        name = name or "anim_" + hashlib.md5(q.encode()).hexdigest()[:6]
        body = json.dumps({"query": "query($q:String!){searchPublicAnimations(query:$q,first:6){edges{node{jsonUrl}}}}", "variables": {"q": q}})
        d = _j(curl("https://graphql.lottiefiles.com/2022-08", ["Content-Type: application/json"], post=body))
        for e in d.get("data", {}).get("searchPublicAnimations", {}).get("edges", []):
            p = self._save(e["node"]["jsonUrl"], name)
            if p and os.path.getsize(p) > 2000: return p
        return None

    # ---------- ИКОНКИ (Iconify, 200k SVG) ----------
    def icon(self, q, color="9AFF00", h=240, name=None):
        name = name or "ic_" + hashlib.md5(q.encode()).hexdigest()[:6]
        d = _j(curl(f"https://api.iconify.design/search?query={urllib.parse.quote(q)}&limit=6"))
        for full in d.get("icons", []):
            p = self._save(f"https://api.iconify.design/{full.replace(':','/')}.svg?color=%23{color}&height={h}", name)
            if p: return p
        return None

    # ---------- SFX (Freesound) ----------
    def sfx(self, q, name=None):
        name = name or "sfx_" + hashlib.md5(q.encode()).hexdigest()[:6]
        params = urllib.parse.urlencode({"query": q, "token": self.FS, "page_size": 4, "fields": "previews", "filter": "duration:[0.1 TO 8]"})
        for r in _j(curl(f"https://freesound.org/apiv2/search/text/?{params}")).get("results", []):
            p = self._save(r["previews"]["preview-hq-mp3"], name)
            if p: return p
        return None

    # ---------- МУЗЫКА (Pixabay Music -> Openverse -> Internet Archive) ----------
    def music(self, q, name=None):
        name = name or "mus_" + hashlib.md5(q.encode()).hexdigest()[:6]
        # Openverse CC audio
        d = _j(curl(f"https://api.openverse.org/v1/audio/?q={urllib.parse.quote(q)}&page_size=4&license=cc0,pdm"))
        for r in d.get("results", []):
            p = self._save(r.get("url"), name)
            if p: return p
        # Internet Archive
        s = _j(curl(f"https://archive.org/advancedsearch.php?q=mediatype:audio+AND+{urllib.parse.quote(q)}&rows=2&fl=identifier&output=json"))
        for doc in s.get("response", {}).get("docs", []):
            meta = _j(curl(f"https://archive.org/metadata/{doc['identifier']}"))
            mp3 = [f["name"] for f in meta.get("files", []) if f.get("name", "").lower().endswith(".mp3")]
            if mp3:
                p = self._save(f"https://archive.org/download/{doc['identifier']}/{urllib.parse.quote(mp3[0])}", name)
                if p: return p
        return None

    # ---------- КАРТИНКИ (Openverse -> Wikimedia -> Pexels) ----------
    def image(self, q, name=None):
        name = name or "img_" + hashlib.md5(q.encode()).hexdigest()[:6]
        d = _j(curl(f"https://api.openverse.org/v1/images/?q={urllib.parse.quote(q)}&page_size=4"))
        for r in d.get("results", []):
            p = self._save(r.get("url"), name)
            if p: return p
        w = _j(curl(f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json"))
        for pg in w.get("query", {}).get("pages", {}).values():
            ii = pg.get("imageinfo", [{}])[0]
            p = self._save(ii.get("thumburl") or ii.get("url"), name)
            if p: return p
        return None

    # ---------- ЭМОДЗИ ----------
    def emoji_anim(self, hexcode, name=None):  # Google Noto animated (gif)
        return self._save(f"https://fonts.gstatic.com/s/e/notoemoji/latest/{hexcode}/512.gif", name or f"noto_{hexcode}")

    def emoji_3d(self, Name, name=None):  # Microsoft Fluent 3D (png)
        lower = Name.lower().replace(" ", "_")
        return self._save(f"https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/{Name}/3D/{lower}_3d.png", name or f"fluent_{lower}")


if __name__ == "__main__":
    r = Router("/tmp/router_demo")
    print("video   ->", r.video("money counting hands"))
    print("sticker ->", r.sticker("fire"))
    print("anim    ->", r.animation("confetti explosion"))
    print("icon    ->", r.icon("rocket launch"))
    print("sfx     ->", r.sfx("whoosh transition"))
    print("music   ->", r.music("cinematic uplifting"))
    print("image   ->", r.image("chrome metal 3d"))
    print("noto    ->", r.emoji_anim("1f680"))
    print("fluent  ->", r.emoji_3d("Rocket"))
