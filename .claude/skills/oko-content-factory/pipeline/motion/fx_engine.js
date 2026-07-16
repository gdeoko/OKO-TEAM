// FX engine — dense alpha overlay generator. node fx.js jobs.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FONTS = 'fonts';
const b64 = f => fs.readFileSync(path.join(FONTS, f)).toString('base64');
const HTML = fs.readFileSync('fx_page.html','utf8')
  .replace('__MB__', b64('MontserratBlack.ttf'))
  .replace('__GL__', b64('golos-text-v7-cyrillic_latin-900.ttf'))
  .replace('__MR__', b64('manrope-v20-cyrillic_latin-800.ttf'));
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--force-color-profile=srgb'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(HTML);
  await page.evaluate(() => window.FONTS_READY());
  for (const job of jobs) {
    fs.mkdirSync(job.dir, { recursive: true });
    await page.evaluate(s => window.FX_SET(s), job);
    for (let f = 0; f < job.frames; f++) {
      await page.evaluate(fr => window.FX_RENDER(fr), f);
      await page.screenshot({ path: path.join(job.dir, String(f).padStart(3, '0') + '.png'), omitBackground: true });
    }
    console.log('FX', job.type, '->', job.dir, job.frames);
  }
  await b.close();
})();
