import os, subprocess, sys, json, glob
os.environ["HF_HUB_DISABLE_XET"]="1"
cand=glob.glob("/kaggle/input/**/ref_vladimir.wav", recursive=True); REF=cand[0] if cand else None
print("REF:",REF,flush=True)
def pip(*a): subprocess.run([sys.executable,"-m","pip","install","-q"]+list(a), check=False)
pip("f5-tts")
pip("ruaccent")
pip("--force-reinstall","--no-deps","torch==2.4.1","torchvision==0.19.1","torchaudio==2.4.1","--index-url","https://download.pytorch.org/whl/cu121")
import torch
print("CUDA:", torch.cuda.is_available(), torch.__version__, flush=True)
try:
    _=(torch.randn(8,8,device="cuda")@torch.randn(8,8,device="cuda")).sum().item(); print("GPU matmul OK",flush=True)
except Exception as e:
    print("GPU FAIL",str(e)[:120],flush=True); sys.exit(2)
if not REF: print("NO_REF"); sys.exit(1)
from huggingface_hub import hf_hub_download
CK=hf_hub_download("Misha24-10/F5-TTS_RUSSIAN","F5TTS_v1_Base_v2/model_last_inference.safetensors")
VB=hf_hub_download("Misha24-10/F5-TTS_RUSSIAN","F5TTS_v1_Base/vocab.txt")
from ruaccent import RUAccent
a=RUAccent()
try: a.load(omograph_model_size='turbo3', use_dictionary=True, tiny_mode=False)
except Exception: a.load(omograph_model_size='turbo', use_dictionary=True)
REFT=a.process_all("Поэтому я стараюсь говорить спокойно, чётко, выговаривая каждое слово. В нашей жизни технологии меняются невероятно быстро.")
inp=glob.glob("/kaggle/input/**/lines.json", recursive=True)
lines=json.load(open(inp[0])) if inp else ["Привет! Меня зовут Владимир.","Это голос для роликов нашей студии — чистый русский, студийное качество.","Один короткий ролик каждый день, без единой ошибки в ударениях."]
from f5_tts.api import F5TTS
f5=F5TTS(model="F5TTS_v1_Base", ckpt_file=CK, vocab_file=VB, device="cuda")
import soundfile as sf, numpy as np
outs=[]; sr=24000
for i,ln in enumerate(lines):
    wav,sr,_=f5.infer(ref_file=REF, ref_text=REFT, gen_text=a.process_all(ln), nfe_step=32, remove_silence=True)
    outs.append(np.asarray(wav)); sf.write(f"/kaggle/working/seg_{i:02d}.wav", np.asarray(wav), sr)
sf.write("/kaggle/working/out.wav", np.concatenate(outs), sr)
print("SEGMENTS", len(lines), "DONE", flush=True)
