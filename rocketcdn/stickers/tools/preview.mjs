/**
 * Рендер .tgs тем же движком, каким их покажет Telegram-подобный плеер.
 *
 * Берёт готовые .tgs, распаковывает, проигрывает через lottie-web в
 * Chromium и снимает кадры. Нужен, чтобы смотреть глазами на результат,
 * а не верить, что JSON собрался правильно.
 *
 *   node preview.mjs <папка_tgs> <папка_png> [кадры]
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join, basename } from 'path';

const [, , srcDir, outDir, framesArg] = process.argv;
const frames = (framesArg || '0,45,90,135').split(',').map(Number);
mkdirSync(outDir, { recursive: true });

// lottie-web кладём локально: на страницу about:blank сеть не нужна
const LOTTIE = readFileSync(
  join(process.cwd(), 'node_modules/lottie-web/build/player/lottie.min.js'),
  'utf8');

const files = readdirSync(srcDir).filter(f => f.endsWith('.tgs')).sort();
if (!files.length) { console.error('нет .tgs в', srcDir); process.exit(1); }

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.addScriptTag({ content: LOTTIE });

let bad = 0;
for (const f of files) {
  const data = JSON.parse(gunzipSync(readFileSync(join(srcDir, f))).toString('utf8'));
  const errs = await page.evaluate(async (anim) => {
    document.body.style.cssText = 'margin:0;width:512px;height:512px';
    document.body.innerHTML = '<div id="h" style="width:512px;height:512px"></div>';
    const errs = [];
    window.onerror = e => errs.push(String(e));
    window.__a = lottie.loadAnimation({
      container: document.getElementById('h'),
      renderer: 'svg', loop: false, autoplay: false, animationData: anim,
    });
    await new Promise(r => setTimeout(r, 60));
    return errs;
  }, data);
  if (errs.length) { console.log('!! ' + f + ': ' + errs.join('; ')); bad++; }

  for (const fr of frames) {
    await page.evaluate(n => window.__a.goToAndStop(n, true), fr);
    // фон под кадром: стикер прозрачный, на клетчатке видно края
    const shot = await page.screenshot({ omitBackground: true });
    writeFileSync(join(outDir, `${basename(f, '.tgs')}_f${fr}.png`), shot);
  }
  console.log('ok ' + f);
}
await browser.close();
process.exit(bad ? 1 : 0);
