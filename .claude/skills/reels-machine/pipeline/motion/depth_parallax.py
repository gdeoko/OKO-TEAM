#!/usr/bin/env python3
"""
2.5D-параллакс из ЛЮБОГО стокового кадра/фото.
Оживляет плоскую картинку: строит карту глубины нейросетью Depth-Anything V2 (ONNX,
локально, без ключей и квот) и рендерит облёт камеры сквозь сцену через three.js.

Требует: onnxruntime, pillow, numpy; модель depth_v2_small.onnx (см. скачивание ниже);
three.js scene pipeline/three/parallax.html поднятый на http.server.

Скачать модель один раз:
  curl -L -H "Authorization: Bearer $HF_TOKEN" -o depth_v2_small.onnx \
    https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx

Usage:
  python depth_parallax.py <input.jpg> <depth_out.png>   # шаг 1: карта глубины
  # затем: http.server + Playwright над parallax.html с window.renderPar(t)
"""
import sys, numpy as np, onnxruntime as ort
from PIL import Image

MODEL = __import__('os').environ.get('DEPTH_MODEL', 'depth_v2_small.onnx')

def depth(img_path, out_path, size=518):
    im = Image.open(img_path).convert('RGB')
    W, H = im.size
    x = np.asarray(im.resize((size, size), Image.BICUBIC)).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    x = ((x - mean) / std).transpose(2, 0, 1)[None]
    sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    d = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    Image.fromarray((d * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).save(out_path)
    print('depth saved', out_path, W, H)

if __name__ == '__main__':
    depth(sys.argv[1], sys.argv[2])
