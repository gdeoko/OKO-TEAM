#!/bin/bash
# Установка ComfyUI + Chroma + Wan 2.2 на rocket-gpu-01
set -x
exec > >(tee -a /home/ubuntu/install.log) 2>&1
echo "=== СТАРТ $(date -u +%H:%M:%S)"

sudo apt-get update -qq
sudo apt-get install -y -qq python3-venv python3-pip git aria2 ffmpeg >/dev/null

cd /home/ubuntu
[ -d ComfyUI ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
[ -d venv ] || python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip wheel

echo "=== TORCH $(date -u +%H:%M:%S)"
pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
echo "=== ЗАВИСИМОСТИ COMFY $(date -u +%H:%M:%S)"
pip install -q -r requirements.txt
pip install -q huggingface_hub hf_transfer gguf sentencepiece protobuf

cd custom_nodes
[ -d ComfyUI-GGUF ] || git clone --depth 1 https://github.com/city96/ComfyUI-GGUF.git
cd /home/ubuntu/ComfyUI

python3 - <<'PY'
import torch
print("TORCH:", torch.__version__, "| CUDA:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("КАРТА:", torch.cuda.get_device_name(0))
    print("bf16 поддержка:", torch.cuda.is_bf16_supported())
    print("видеопамять, ГБ:", round(torch.cuda.get_device_properties(0).total_memory/1024**3,1))
PY
echo "=== УСТАНОВКА ГОТОВА $(date -u +%H:%M:%S)"
df -h / | tail -1
