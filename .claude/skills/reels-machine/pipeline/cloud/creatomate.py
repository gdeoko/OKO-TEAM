"""
Creatomate — шаблонный/программный видео-рендер (reels-machine, OKO TEAM).

Зачем: рендер видео по готовому шаблону (template_id + modifications) или по
inline-source (JSON-сцена). Идеально для серийных соцроликов «по данным»:
один шаблон, разные тексты/картинки/видео на входе -> пачка роликов.

Ключи (secrets.env):
  CREATOMATE_API_KEY       — серверный, Bearer. Держать на бэке, в браузер НЕ отдавать.
  CREATOMATE_PUBLIC_TOKEN  — публичный (public-...), только для клиентского preview-плеера.

ВАЖНО: сеть только через curl (requests/urllib идут мимо прокси окружения).

Примеры:
  from cloud import creatomate as cm
  # по шаблону:
  mp4 = cm.render(template_id="d0f50da1-...", modifications={
            "Text-1.text": "Заголовок", "Video.source": "https://.../clip.mp4"},
        out_path="promo.mp4")
  # по inline-сцене (без шаблона):
  mp4 = cm.render(source=scene_dict, out_path="scene.mp4")
  # пачка по шаблону:
  paths = cm.batch(template_id, [ {mods1}, {mods2}, ... ], out_dir="renders")
"""
import json, os, subprocess, time

_API = "https://api.creatomate.com/v1/renders"


def _key():
    k = os.environ.get("CREATOMATE_API_KEY")
    if not k:
        raise RuntimeError(
            "нет CREATOMATE_API_KEY — выполни: source <(base64 -d secrets.env.b64)")
    return k


def _curl(method, url, body=None, timeout=120):
    cmd = ["curl", "-sS", "--max-time", str(timeout), "-X", method, url,
           "-H", f"Authorization: Bearer {_key()}",
           "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"curl error: {out.stderr[-500:]}")
    txt = out.stdout.strip()
    try:
        return json.loads(txt) if txt else {}
    except json.JSONDecodeError:
        raise RuntimeError(f"Creatomate не JSON: {txt[:300]}")


def download(url, out_path, timeout=300):
    subprocess.run(["curl", "-sSL", "--max-time", str(timeout), "-o", out_path, url],
                   check=True)
    return out_path


def render(template_id=None, modifications=None, source=None,
           out_path=None, poll=True, timeout=600, verbose=True, **extra):
    """Запустить один рендер. Нужно ровно одно из: template_id | source.
      template_id + modifications — рендер по шаблону из аккаунта Creatomate.
      source — inline JSON-сцена (elements/tracks) без шаблона.
    Вернёт URL готового видео (или out_path, если задан — тогда ещё и скачает)."""
    if not template_id and not source:
        raise ValueError("нужен template_id или source")
    body = dict(extra)
    if template_id:
        body["template_id"] = template_id
    if modifications:
        body["modifications"] = modifications
    if source:
        body["source"] = source
    data = _curl("POST", _API, body)
    rec = data[0] if isinstance(data, list) else data
    if "id" not in rec:
        raise RuntimeError(f"Creatomate submit fail: {json.dumps(rec)[:400]}")
    rid, status, url = rec["id"], rec.get("status"), rec.get("url")
    if verbose:
        print(f"[creatomate] submitted {rid} status={status}")
    if not poll:
        return rid
    t0 = time.time()
    while status not in ("succeeded", "failed") and time.time() - t0 < timeout:
        time.sleep(4)
        rec = _curl("GET", f"{_API}/{rid}")
        status, url = rec.get("status"), rec.get("url")
        if verbose:
            print(f"[creatomate] {status} ({int(time.time()-t0)}s)")
    if status == "failed":
        raise RuntimeError(f"Creatomate failed: {rec.get('error_message')}")
    if status != "succeeded":
        raise TimeoutError(f"Creatomate timeout ({timeout}s), id={rid}")
    return download(url, out_path) if (out_path and url) else url


def batch(template_id, mods_list, out_dir=".", prefix="cm_", **kw):
    """Отрендерить пачку по одному шаблону. mods_list — список dict modifications.
    Вернёт список путей к MP4."""
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for i, mods in enumerate(mods_list):
        p = os.path.join(out_dir, f"{prefix}{i:03d}.mp4")
        paths.append(render(template_id=template_id, modifications=mods,
                            out_path=p, **kw))
    return paths


if __name__ == "__main__":
    # смоук-тест: inline-сцена 1080x1920, 2с, текст на бренд-фоне (тратит 1 кредит)
    scene = {
        "output_format": "mp4", "width": 1080, "height": 1920, "duration": 2,
        "elements": [
            {"type": "shape", "width": "100%", "height": "100%",
             "fill_color": "#0d0d0d"},
            {"type": "text", "text": "OKO TEAM", "font_family": "Montserrat",
             "font_weight": "800", "fill_color": "#9AFF00",
             "font_size": "12 vmin", "x_alignment": "50%", "y_alignment": "50%"}]}
    print(render(source=scene, out_path="creatomate_smoke.mp4"))
