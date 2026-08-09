/* Контактный лист спрайта: рисует все символы сеткой, чтобы кривые иконки
   были видны глазами, а не угадывались по коду. */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const html = await fs.readFile('oko-app/prototype/index.html', 'utf-8');
/* Берём именно блоки <symbol>...</symbol>, а не кусок файла между первым и
   последним — иначе в лист утаскивается вся разметка приложения. */
const syms = [...html.matchAll(/<symbol id="(i-[^"]+)"[\s\S]*?<\/symbol>/g)];
const ids = syms.map(m => m[1]);
const sprite = syms.map(m => m[0]).join('\n');

const page = `<!doctype html><meta charset="utf-8"><style>
body{background:#0a0d05;color:#9AFF00;font:12px system-ui;margin:0;padding:16px}
.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:14px}
.c{display:flex;flex-direction:column;align-items:center;gap:5px;background:#12160c;border:1px solid #2a3320;border-radius:10px;padding:10px 4px}
svg.i{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
svg.i .fillp{fill:currentColor;stroke:none}
small{color:#8a9a72;font-size:9px;text-align:center;word-break:break-all}
</style><svg style="display:none">${sprite}</svg><div class="grid">${
  ids.map(id => `<div class="c"><svg class="i"><use href="#${id}"/></svg><small>${id}</small></div>`).join('')
}</div>`;

await fs.writeFile('/tmp/icons.html', page);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await p.goto('file:///tmp/icons.html');
await p.waitForTimeout(400);
await p.screenshot({ path: 'oko-app/tools/shots/icons.png', fullPage: true });
console.log('символов:', ids.length);
await b.close();
