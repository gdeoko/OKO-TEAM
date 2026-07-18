#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Клон голоса Даниэля (OKO) через бесплатный HF Space k2-fsa/OmniVoice.
Озвучивает ЛЮБОЙ текст голосом из reference/daniel_ref_15s.wav.

Быстрый старт:
    pip install -r requirements.txt
    python clone_voice_omnivoice.py "Привет! Это команда ОКО." out.wav

Опции:
    python clone_voice_omnivoice.py "текст" out.wav --ref reference/daniel_ref_30s.wav --du 20

HF-токен (необязательно, но снимает лимиты ZeroGPU):
    получить на https://huggingface.co/settings/tokens  ->  export HF_TOKEN=hf_xxx
Бесплатно и безлимитно. Русский поддерживается (lang="Russian").
"""
import os, sys, shutil, argparse

SPACE = "k2-fsa/OmniVoice"          # https://huggingface.co/spaces/k2-fsa/OmniVoice
DEFAULT_REF = os.path.join(os.path.dirname(__file__), "reference", "daniel_ref_15s.wav")

def estimate_du(text: str) -> float:
    """Оценка длительности, чтобы фраза не обрезалась (~0.55с на слово, минимум 8с)."""
    words = max(1, len(text.split()))
    return max(8.0, round(words * 0.55 + 2, 1))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text", help="Текст для озвучки")
    ap.add_argument("out", nargs="?", default="out.wav", help="Куда сохранить (wav)")
    ap.add_argument("--ref", default=DEFAULT_REF, help="Референс-аудио (голос-сид)")
    ap.add_argument("--lang", default="Russian", help="Язык (Russian/English/...)")
    ap.add_argument("--du", type=float, default=None, help="Длительность, с (по умолчанию авто)")
    ap.add_argument("--ns", type=float, default=48, help="Шаги качества (больше=чище, дольше)")
    ap.add_argument("--gs", type=float, default=2.0, help="Guidance scale")
    args = ap.parse_args()

    try:
        from gradio_client import Client, handle_file
    except ImportError:
        sys.exit("Установи зависимости:  pip install -r requirements.txt")

    du = args.du if args.du is not None else estimate_du(args.text)
    token = os.environ.get("HF_TOKEN")  # необязательно
    print(f"[clone] space={SPACE} lang={args.lang} du={du}s ref={args.ref}")
    c = Client(SPACE, token=token, verbose=False)
    r = c.predict(
        text=args.text, lang=args.lang,
        ref_aud=handle_file(args.ref),
        ref_text="", instruct="",
        ns=args.ns, gs=args.gs, dn=True, sp=1.0, du=du, pp=True, po=True,
        api_name="/_clone_fn",
    )
    out_path = r[0] if isinstance(r, (list, tuple)) else r
    shutil.copy(out_path, args.out)
    print(f"[clone] готово -> {args.out}")

if __name__ == "__main__":
    main()
