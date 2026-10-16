/**
 * Измерение готовых .tgs: где на самом деле лежит рисунок.
 *
 * Пак выглядит ровным, когда предметы в нём одного оптического размера и
 * стоят по одному центру. На глаз это не выставить: у планеты габарит
 * задаёт круг, у ракеты - диагональ со шлейфом. Поэтому каждый стикер
 * прогоняется через настоящий плеер, снимается несколько кадров, и по
 * альфа-каналу считается рамка рисунка за всю анимацию.
 *
 *   node measure.mjs <папка_tgs> <куда_json> [кадры]
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join, basename } from 'path';
import { PNG } from 'pngjs';

const [, , srcDir, outJson, framesArg] = process.argv;
// кадры по всей длине: анимация может выносить предмет за его же покой
const frames = (framesArg || '0,30,60,90,120,150,179').split(',').map(Number);

const LOTTIE = readFileSync(
  join(process.cwd(), 'node_modules/lottie-web/build/player/lottie.min.js'),
  'utf8');

const files = readdirSync(srcDir).filter(f => f.endsWith('.tgs')).sort();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.addScriptTag({ content: LOTTIE });

const out = {};
for (const f of files) {
  const data = JSON.parse(gunzipSync(readFileSync(join(srcDir, f))).toString());
  await page.evaluate(async (anim) => {
    document.body.style.cssText = 'margin:0;width:512px;height:512px';
    document.body.innerHTML = '<div id="h" style="width:512px;height:512px"></div>';
    window.__a = lottie.loadAnimation({
      container: document.getElementById('h'), renderer: 'svg',
      loop: false, autoplay: false, animationData: anim,
    });
    await new Promise(r => setTimeout(r, 50));
  }, data);

  let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
  for (const fr of frames) {
    await page.evaluate(n => window.__a.goToAndStop(n, true), fr);
    const buf = await page.screenshot({ omitBackground: true });
    const png = PNG.sync.read(buf);
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        // слабую дымку свечения в габарит не берём: иначе рамку
        // раздувает ореол, а не сам предмет
        if (png.data[(png.width * y + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  const key = basename(f, '.tgs');
  if (x1 <= x0 || y1 <= y0) {
    console.log('!! ' + key + ': пусто');
    continue;
  }
  out[key] = { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1,
               cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  console.log('%s  %dx%d  центр %d,%d', key.padEnd(9),
              out[key].w, out[key].h, Math.round(out[key].cx),
              Math.round(out[key].cy));
}
await browser.close();
writeFileSync(outJson, JSON.stringify(out, null, 1));
console.log('\nзамеры записаны: ' + outJson);
