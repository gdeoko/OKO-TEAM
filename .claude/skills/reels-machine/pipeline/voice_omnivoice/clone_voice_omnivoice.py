#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Клон голоса через бесплатный HF Space k2-fsa/OmniVoice (метод Даниэля).
    pip install gradio_client
    python clone_voice_omnivoice.py "текст" out.wav --ref reference/vladimir_ref_30s.wav
HF_TOKEN (необязательно, снимает лимиты ZeroGPU): export HF_TOKEN=hf_xxx"""
import os, sys, shutil, argparse
SPACE = "k2-fsa/OmniVoice"
DEFAULT_REF = os.path.join(os.path.dirname(__file__), "reference", "vladimir_ref_30s.wav")
def estimate_du(text): 
    return max(8.0, round(max(1, len(text.split())) * 0.55 + 2, 1))
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text"); ap.add_argument("out", nargs="?", default="out.wav")
    ap.add_argument("--ref", default=DEFAULT_REF); ap.add_argument("--lang", default="Russian")
    ap.add_argument("--du", type=float, default=None); ap.add_argument("--ns", type=float, default=48)
    ap.add_argument("--gs", type=float, default=2.0); args = ap.parse_args()
    from gradio_client import Client, handle_file
    du = args.du if args.du is not None else estimate_du(args.text)
    c = Client(SPACE, token=os.environ.get("HF_TOKEN"), verbose=False)
    r = c.predict(text=args.text, lang=args.lang, ref_aud=handle_file(args.ref),
        ref_text="", instruct="", ns=args.ns, gs=args.gs, dn=True, sp=1.0, du=du,
        pp=True, po=True, api_name="/_clone_fn")
    shutil.copy(r[0] if isinstance(r,(list,tuple)) else r, args.out)
    print(f"[clone] готово -> {args.out}")
if __name__ == "__main__": main()
