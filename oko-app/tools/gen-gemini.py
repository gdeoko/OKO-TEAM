#!/usr/bin/env python3
"""
OKO · Генерация картинок через Gemini (платный ключ, безлимит по задачам).

Ключ живёт в секретах репозитория агентов: `/workspace/oko-agents/secrets.env.b64`,
переменная GEMINI_KEY_PAID, модель GEMINI_MODEL_IMAGE (gemini-2.5-flash-image,
она же nano banana). Вывод БЕЗ клейма модели - стирать ничего не нужно.

Проверено 12.08: HTTP 200, PNG на 1024x1024, чистый кадр.

Использование:
  python3 gen-gemini.py --prompt-file p.txt --out hero.png
  python3 gen-gemini.py --prompt "..." --out x.png --ratio 16:9
  python3 gen-gemini.py --batch задания.json      # пачкой

Формат --batch: [{"prompt_file":"p1.txt","out":"a.png","ratio":"1:1"}, ...]

Промпт - ВСЕГДА на английском и детальный (правило проекта: от 2000 символов).
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import time

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
RATIOS = {"1:1": (1024, 1024), "16:9": (1408, 792), "9:16": (792, 1408),
          "4:3": (1184, 888), "3:4": (888, 1184), "3:2": (1248, 832)}


def ключ():
    k = os.environ.get("GEMINI_KEY_PAID") or os.environ.get("GEMINI_API_KEY")
    if k:
        return k
    # поднять из секретов агентов, если сессия их не загрузила
    p = "/workspace/oko-agents/secrets.env.b64"
    if os.path.exists(p):
        try:
            raw = base64.b64decode(open(p, "rb").read()).decode("utf-8", "replace")
            for line in raw.splitlines():
                line = line.strip().removeprefix("export ").strip()
                for name in ("GEMINI_KEY_PAID=", "GEMINI_API_KEY="):
                    if line.startswith(name):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    raise SystemExit("нет GEMINI_KEY_PAID (секреты агентов: /workspace/oko-agents/secrets.env.b64)")


def модель():
    return os.environ.get("GEMINI_MODEL_IMAGE") or "gemini-2.5-flash-image"


def генерировать(prompt, out, ratio="1:1", попыток=3):
    """Через curl: node/python fetch мимо прокси в этой среде не ходят."""
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }
    if ratio in RATIOS:
        body["generationConfig"]["imageConfig"] = {"aspectRatio": ratio}

    url = API.format(model=модель())
    tmp = f"/tmp/gemgen_{os.getpid()}_{int(time.time()*1000)}.json"
    последняя = ""
    for попытка in range(1, попыток + 1):
        try:
            r = subprocess.run(
                ["curl", "-s", "-m", "180", "-X", "POST", url,
                 "-H", f"x-goog-api-key: {ключ()}",
                 "-H", "Content-Type: application/json",
                 "--data-binary", "@-", "-o", tmp, "-w", "%{http_code}"],
                input=json.dumps(body).encode(), capture_output=True, timeout=200)
            code = (r.stdout or b"").decode().strip()
            if code != "200":
                последняя = f"HTTP {code}: " + open(tmp, encoding="utf-8", errors="replace").read()[:300] if os.path.exists(tmp) else f"HTTP {code}"
                time.sleep(2 * попытка)
                continue
            d = json.load(open(tmp, encoding="utf-8"))
            for part in d["candidates"][0]["content"]["parts"]:
                if "inlineData" in part:
                    data = base64.b64decode(part["inlineData"]["data"])
                    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
                    open(out, "wb").write(data)
                    return out, len(data)
            последняя = "в ответе нет картинки: " + json.dumps(d)[:300]
        except Exception as e:
            последняя = f"{type(e).__name__}: {e}"
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
        time.sleep(2 * попытка)
    raise RuntimeError(последняя or "не вышло")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--out")
    ap.add_argument("--ratio", default="1:1", choices=list(RATIOS))
    ap.add_argument("--batch", help="JSON со списком заданий")
    a = ap.parse_args()

    if a.batch:
        задания = json.load(open(a.batch, encoding="utf-8"))
        готово, сломалось = 0, []
        for з in задания:
            текст = з.get("prompt") or open(з["prompt_file"], encoding="utf-8").read().strip()
            try:
                путь, n = генерировать(текст, з["out"], з.get("ratio", "1:1"))
                print(f"  готово {путь}  {n // 1024} КБ")
                готово += 1
            except Exception as e:
                print(f"  НЕ ВЫШЛО {з['out']}: {e}", file=sys.stderr)
                сломалось.append(з["out"])
        print(f"\nитого: {готово} из {len(задания)}" + (f", не вышло: {', '.join(сломалось)}" if сломалось else ""))
        sys.exit(1 if сломалось else 0)

    текст = a.prompt or (open(a.prompt_file, encoding="utf-8").read().strip() if a.prompt_file else "")
    if not текст or not a.out:
        raise SystemExit("нужны --prompt/--prompt-file и --out")
    if len(текст) < 400:
        print(f"ВНИМАНИЕ: промпт короткий ({len(текст)} симв). Правило проекта - от 2000.", file=sys.stderr)
    путь, n = генерировать(текст, a.out, a.ratio)
    print(f"готово: {путь}  {n // 1024} КБ")
