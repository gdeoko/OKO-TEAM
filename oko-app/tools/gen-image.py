#!/usr/bin/env python3
"""
OKO · Генератор картинок через HF Spaces (ZeroGPU, бесплатно, без кредитов).

Почему так: Higgsfield кончился (Out of credits), fal.ai заблокирован (TOP_UP),
платного Gemini-ключа в окружении нет. HF Spaces через gradio_client работает по
HF_TOKEN (квоты ZeroGPU) и ничего не стоит - это документированный рабочий путь
этой среды (скилл oko-magic, раздел про генерацию).

Модели:
  z      Tongyi-MAI/Z-Image-Turbo   /generate  - быстрая (8 шагов), чистая графика
  flux   mcp-tools/FLUX.1-Krea-dev  /infer     - красивее, медленнее
  qwen   mcp-tools/Qwen-Image       /infer     - когда нужен ТЕКСТ на картинке

Промпт - ВСЕГДА на английском и детальный (правило проекта: от 2000 символов):
сцена, объект, материалы, свет, объектив, композиция, цвета в HEX, настроение,
негативное пространство, качество.

Использование:
  python3 gen-image.py --prompt-file p.txt --out media/img/hero.png [--model z] [--seed 42]
  python3 gen-image.py --prompt "..." --out out.png
"""
import argparse
import os
import shutil
import sys

SPACES = {
    # эталонный FLUX от Black Forest Labs: размер/шаги/seed под контролем,
    # вывод БЕЗ клейма модели - это основной рабочий спейс
    "flux": ("black-forest-labs/FLUX.1-schnell", "/infer"),
    # быстрый, но ставит своё клеймо в правом нижнем углу - держим как резерв
    "z":    ("Tongyi-MAI/Z-Image-Turbo",  "/generate"),
    "qwen": ("mcp-tools/Qwen-Image",      "/infer"),
}
# у каких спейсов есть размер и шаги
SIZED = {"flux"}


def pick_path(result):
    """Достать путь к файлу из ответа спейса (форматы у спейсов разные)."""
    def walk(x):
        if isinstance(x, str):
            return x if x.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) else None
        if isinstance(x, dict):
            for k in ("image", "path", "url", "value"):
                if k in x:
                    got = walk(x[k])
                    if got:
                        return got
            for v in x.values():
                got = walk(v)
                if got:
                    return got
            return None
        if isinstance(x, (list, tuple)):
            for v in x:
                got = walk(v)
                if got:
                    return got
        return None
    return walk(result)


def generate(prompt, out, model="flux", seed=None, retries=2, width=1024, height=1024, steps=8):
    from gradio_client import Client
    space, api = SPACES[model]
    token = os.environ.get("HF_TOKEN")
    last = None
    for attempt in range(retries + 1):
        try:
            c = Client(space, token=token, verbose=False)
            kw = {"prompt": prompt}
            if model in SIZED:
                kw.update(width=int(width), height=int(height), num_inference_steps=int(steps))
                kw["randomize_seed"] = seed is None
                kw["seed"] = int(seed) if seed is not None else 0
            elif seed is not None:
                kw["seed"] = int(seed)
                if model == "z":
                    kw["random_seed"] = False
            try:
                res = c.predict(api_name=api, **kw)
            except TypeError:
                res = c.predict(api_name=api, prompt=prompt)   # спейс без доп-параметров
            src = pick_path(res)
            if not src or not os.path.exists(src):
                raise RuntimeError(f"нет файла в ответе: {str(res)[:200]}")
            os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
            shutil.copy(src, out)
            return out
        except Exception as e:
            last = e
            print(f"  попытка {attempt + 1} не вышла: {type(e).__name__}: {str(e)[:180]}", file=sys.stderr)
    raise SystemExit(f"генерация не удалась: {last}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="flux", choices=list(SPACES))
    ap.add_argument("--seed", type=int)
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--height", type=int, default=1024)
    ap.add_argument("--steps", type=int, default=8)
    a = ap.parse_args()
    text = a.prompt
    if a.prompt_file:
        text = open(a.prompt_file, encoding="utf-8").read().strip()
    if not text:
        raise SystemExit("нужен --prompt или --prompt-file")
    if len(text) < 400:
        print(f"ВНИМАНИЕ: промпт короткий ({len(text)} символов). Правило проекта - детальный промпт от 2000.", file=sys.stderr)
    print(f"→ {a.model} · {len(text)} символов промпта → {a.out}")
    print("готово:", generate(text, a.out, a.model, a.seed,
                              width=a.width, height=a.height, steps=a.steps))
