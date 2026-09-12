"""
Shotstack — облачный программный монтаж по JSON (reels-machine, OKO TEAM).

Зачем: альтернатива локальному 3-этапному ffmpeg-конвейеру. Отдаёшь таймлайн
(клипы, титры, переходы, аудио) в JSON — Shotstack рендерит MP4 в облаке и
отдаёт ссылку. Удобно, когда нужен быстрый чистый монтаж без ручного ffmpeg,
или когда рендер надо запускать автоматически из кода.

Ключи (secrets.env, автозагрузка SessionStart-хуком):
  SHOTSTACK_SANDBOX_KEY  — бесплатно, вотермарк «Shotstack» на видео.
  SHOTSTACK_PROD_KEY     — платно, без вотермарка.

ВАЖНО (грабли окружения): сеть только через curl. requests/urllib ходят мимо
корпоративного прокси и виснут — поэтому все запросы тут через subprocess+curl.

Примеры:
  from cloud import shotstack as ss
  # 1) готовый edit-JSON:
  mp4 = ss.render(edit_dict, env="sandbox", out_path="out.mp4")
  # 2) вертикальный ролик из списка шотов + караоке-субтитров:
  tl  = ss.build_vertical(shots, subs=subs, music_url=music, bg="#0d0d0d")
  mp4 = ss.render(tl, env="sandbox", out_path="reel.mp4")
"""
import json, os, subprocess, time

STAGE = {"sandbox": "stage", "prod": "v1"}
_BASE = "https://api.shotstack.io/edit/{stage}"
_ING  = "https://api.shotstack.io/ingest/{stage}"


def _key(env):
    name = "SHOTSTACK_SANDBOX_KEY" if env == "sandbox" else "SHOTSTACK_PROD_KEY"
    k = os.environ.get(name)
    if not k:
        raise RuntimeError(
            f"нет {name} в окружении — выполни: . ~/.oko/secrets.env")
    return k


def _curl(method, url, key, body=None, timeout=120):
    cmd = ["curl", "-sS", "--max-time", str(timeout), "-X", method, url,
           "-H", f"x-api-key: {key}", "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"curl error: {out.stderr[-500:]}")
    txt = out.stdout.strip()
    try:
        return json.loads(txt) if txt else {}
    except json.JSONDecodeError:
        raise RuntimeError(f"Shotstack не JSON: {txt[:300]}")


def download(url, out_path, timeout=300):
    subprocess.run(["curl", "-sSL", "--max-time", str(timeout), "-o", out_path, url],
                   check=True)
    return out_path


def render(edit, env="sandbox", out_path=None, poll=True, timeout=600, verbose=True):
    """Отправить edit-JSON на рендер. Вернуть URL готового MP4 (или out_path,
    если задан — тогда ещё и скачает). edit может быть:
      - полный {"timeline":..., "output":...}
      - только timeline-dict (тогда обернём в дефолтный вертикальный output)."""
    stage = STAGE[env]
    key = _key(env)
    base = _BASE.format(stage=stage)
    if "timeline" not in edit:
        edit = {"timeline": edit,
                "output": {"format": "mp4", "size": {"width": 1080, "height": 1920}}}
    r = _curl("POST", f"{base}/render", key, edit)
    if not r.get("success"):
        raise RuntimeError(f"Shotstack submit fail: {json.dumps(r)[:400]}")
    rid = r["response"]["id"]
    if verbose:
        print(f"[shotstack] submitted {rid} ({env})")
    if not poll:
        return rid
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = _curl("GET", f"{base}/render/{rid}", key)["response"]
        status = st["status"]
        if verbose:
            print(f"[shotstack] {status} ({int(time.time()-t0)}s)")
        if status == "done":
            url = st["url"]
            return download(url, out_path) if out_path else url
        if status == "failed":
            raise RuntimeError(f"Shotstack render failed: {st.get('error')}")
        time.sleep(4)
    raise TimeoutError(f"Shotstack render timeout ({timeout}s), id={rid}")


def ingest(url, env="sandbox", poll=True, timeout=600, verbose=True):
    """Залить внешний ассет (видео/картинку/аудио) в Shotstack-хранилище.
    Вернёт готовый CDN-URL ассета (можно класть в timeline). Ускоряет рендер
    и снимает проблемы с недоступными исходниками."""
    stage = STAGE[env]
    key = _key(env)
    base = _ING.format(stage=stage)
    r = _curl("POST", f"{base}/sources", key, {"url": url})
    sid = r["data"]["id"]
    if not poll:
        return sid
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = _curl("GET", f"{base}/sources/{sid}", key)["data"]["attributes"]
        if st.get("status") == "ready":
            return st["source"]
        if st.get("status") == "failed":
            raise RuntimeError(f"Shotstack ingest failed: {st.get('error')}")
        time.sleep(4)
    raise TimeoutError(f"Shotstack ingest timeout, id={sid}")


# ---- мост: список шотов reels-machine -> Shotstack timeline -------------------

def build_vertical(shots, subs=None, music_url=None, bg="#0d0d0d",
                   size=(1080, 1920), transition="fade"):
    """Собрать вертикальный timeline 1080x1920 из простого списка.

    shots: список dict, каждый:
        {"src": <url mp4/jpg>, "length": сек,
         "start"?: авто-подряд если нет, "trim"?: сек от начала src,
         "effect"?: "zoomIn"|"zoomOut"|"slideLeft"..., "fit"?: "cover"}
    subs:  необяз. список {"text":..., "start":..., "length":...,
                            "color"?: "#9AFF00", "size"?: "large"}
           титры кладутся отдельной верхней дорожкой (караоке-стиль — по слову).
    music_url: необяз. фоновая музыка (url), приглушается автоматически.
    """
    W, H = size
    clips, t = [], 0.0
    for sh in shots:
        start = sh.get("start", t)
        length = sh["length"]
        asset = {"type": "video" if str(sh["src"]).lower().rstrip("/").endswith(
                     (".mp4", ".mov", ".webm")) else "image",
                 "src": sh["src"]}
        if asset["type"] == "video" and sh.get("trim"):
            asset["trim"] = sh["trim"]
        clip = {"asset": asset, "start": round(start, 3), "length": length,
                "fit": sh.get("fit", "cover")}
        if sh.get("effect"):
            clip["effect"] = sh["effect"]
        if transition:
            clip["transition"] = {"in": transition, "out": transition}
        clips.append(clip)
        t = start + length
    tracks = [{"clips": clips}]

    if subs:
        sub_clips = []
        for s in subs:
            sub_clips.append({
                "asset": {"type": "title", "text": s["text"],
                          "style": s.get("style", "future"),
                          "color": s.get("color", "#9AFF00"),
                          "size": s.get("size", "large"),
                          "position": s.get("position", "bottom")},
                "start": round(s["start"], 3), "length": s["length"],
                "transition": {"in": "fade", "out": "fade"}})
        tracks.insert(0, {"clips": sub_clips})  # верхняя дорожка = поверх

    timeline = {"background": bg, "tracks": tracks}
    if music_url:
        timeline["soundtrack"] = {"src": music_url, "effect": "fadeInFadeOut",
                                  "volume": 0.15}
    return {"timeline": timeline,
            "output": {"format": "mp4", "size": {"width": W, "height": H},
                       "fps": 30}}


if __name__ == "__main__":
    # смоук-тест: короткий титульный ролик в sandbox (бесплатно, с вотермарком)
    edit = {
        "timeline": {"background": "#0d0d0d", "tracks": [{"clips": [
            {"asset": {"type": "title", "text": "OKO TEAM", "style": "future",
                       "color": "#9AFF00", "size": "x-large"},
             "start": 0, "length": 3,
             "transition": {"in": "fade", "out": "fade"}, "effect": "zoomIn"}]}]},
        "output": {"format": "mp4", "size": {"width": 1080, "height": 1920}}}
    print(render(edit, env="sandbox", out_path="shotstack_smoke.mp4"))
