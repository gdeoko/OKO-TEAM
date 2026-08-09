/* Уменьшаем фото основателя без ImageMagick и PIL — их в песочнице нет.
   Chromium умеет canvas, этого достаточно: рисуем в нужный размер и
   отдаём JPEG. Мастер-файл кладём в бренд, рабочие размеры — в media. */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const SRC = '/root/.claude/uploads/f2926e2e-e87a-533d-ad5f-80dfd2fdcad5/f2032f36-hf_20260711_183416_b109e90d301248e692ff459c66e1f99e.png';
const b64 = (await fs.readFile(SRC)).toString('base64');

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
await p.goto('about:blank');

const размеры = [[1024,0.92],[512,0.9],[256,0.88],[128,0.88],[64,0.9]];
const out = await p.evaluate(async ([data, список]) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
  const r = {};
  for (const [s, q] of список) {
    const cv = document.createElement('canvas');
    cv.width = s; cv.height = s;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, s, s);
    r[s] = cv.toDataURL('image/jpeg', q).split(',')[1];
  }
  return r;
}, [b64, размеры]);
await b.close();

await fs.mkdir('oko-app/brand/founder', { recursive: true });
await fs.mkdir('oko-app/prototype/media/founder', { recursive: true });
await fs.writeFile('oko-app/brand/founder/daniel-master.png', Buffer.from(b64, 'base64'));
for (const [s] of размеры) {
  const buf = Buffer.from(out[s], 'base64');
  const путь = s === 1024 ? 'oko-app/brand/founder/daniel-1024.jpg' : `oko-app/prototype/media/founder/daniel-${s}.jpg`;
  await fs.writeFile(путь, buf);
  console.log(путь, (buf.length/1024).toFixed(0) + ' КБ');
}
